/**
 * Find and control USB devices being handled by the linux 'usbled' driver.
 *
 * We use the node synchronous I/O mechanism here for reads since we are reading
 * from and writing to (sysfs) virtual files.  If you look at the source here:
 * https://git.kernel.org/cgit/linux/kernel/git/torvalds/linux.git/tree/drivers/usb/misc/usbled.c?id=refs/tags/v3.14-rc7
 * we can see that the reads are serviced from the kernel data structures and
 * are not read out from the device.  Writes, however, use usb_control_msg which
 * is documented to be blocking at
 * https://www.kernel.org/doc/htmldocs/usb/API-usb-control-msg.html
 * so we do an async write.
 *
 * We do not maintain any state inside ourselves.  This makes us potentially
 * more cooperative with other code, although that would be silly to have two
 * things messing with an LED at the same time.  Our read-out logic is mainly
 * useful if you use this logic to set a color and then quit.
 *
 */
var udev = require('udev');
var fs = require('fs');
var Chromath = require('chromath');

function find_led_devices() {
  var devs = udev.list().filter(function(dev) {
    return dev.DRIVER === 'usbled';
  });
  return devs;
}

function readFileInt(path) {
  // really ASCII would be fine too.
  return parseInt(fs.readFileSync(path, { encoding: 'utf-8' }), 10);
}

function writeFileInt(path, val) {
  fs.writeFile(path, val.toString());
}

/**
 * While usbled supports up to 255, the device seems to actually top out at 64.
 */
var SCALE = 64;
function LED(syspath) {
  this.syspath = syspath;
}
LED.prototype = {
  get red() {
    return readFileInt(this.syspath + '/red');
  },
  set red(val) {
    writeFileInt(this.syspath + '/red', val);
  },
  get green() {
    return readFileInt(this.syspath + '/green');
  },
  set green(val) {
    writeFileInt(this.syspath + '/green', val);
  },
  get blue() {
    return readFileInt(this.syspath + '/blue');
  },
  set blue(val) {
    writeFileInt(this.syspath + '/blue', val);
  },
  /**
   * Set raw, unscaled RGB values to the device.
   */
  setRawRGB: function(r, g, b) {
    this.red = r;
    this.green = g;
    this.blue = b;
  },
  setColor: function(whatever) {
    var color;
    if (whatever instanceof Chromath) {
      color = whatever;
    }
    else {
      color = new Chromath(whatever);
    }
    this.red = Math.floor(color.r * 50);
    this.green = Math.floor(color.g * 50);
    this.blue = Math.floor(color.b * 50);
  }
};

function getLEDs() {
  var devs = find_led_devices();
  return devs.map(function(dev) {
    return new LED(dev.syspath);
  });
}

/**
 * In the future when 'define' is implemented, load the persisted order of the
 * LEDs from disk.
 */
function getOrderedLEDs() {
  return getLEDs();
}

var identifyColors = [
  'red', 'green', 'blue', 'yellow', 'purple', 'white', 'cyan',
  'orange', 'brown', 'pink',
];

function cmd_identify() {
  var leds = getLEDs();
  console.log('I found', leds.length, 'usbled devices.');
  console.log('I set them to the following colors:');
  for (var i = 0; i < leds.length; i++) {
    var led = leds[i];
    var color = identifyColors[i];
    led.setColor(color);
    console.log('  ', color);
  }
  console.log('\nTo save them to an order, use the define command.');
  console.log('For example, if you had three lights, you might write:');
  console.log('  node ledcontrol.js define green blue red');
}

function cmd_define() {
}

function cmd_read(phase) {
  var leds = getOrderedLEDs();
  for (var i = 0; i < leds.length; i++) {
    var led = leds[i];
    console.log(led.red, led.green, led.blue);
  }
}

function cmd_raw(r, g, b) {
  var leds = getLEDs();
  for (var i = 0; i < leds.length; i++) {
    var led = leds[i];
    led.setRawRGB(parseInt(r, 10), parseInt(g, 10), parseInt(b, 10));
  }
}


function cmd_all(color) {
  var leds = getLEDs();
  for (var i = 0; i < leds.length; i++) {
    var led = leds[i];
    led.setColor(color);
  }
}

function cmd_set() {
  var leds = getLEDs();
  var colors = this.args.slice(0, -1);
  for (var i = 0; i < leds.length; i++) {
    var led = leds[i];
    var color;
    if (i < colors.length)
      color = colors[i];
    else
      color = 'black';
    led.setColor(color);
  }
}

function cmd_progress(percent, color) {
  percent = percent / 100;
  color = new Chromath(color);
  var black = new Chromath('black');
  var leds = getOrderedLEDs();
  for (var i = 0; i < leds.length; i++) {
    var led = leds[i];
    var ledEmptyAt = i / leds.length;
    var ledFullAt = (i + 1) / leds.length;
    if (percent < ledEmptyAt) {
      led.setColor(black);
    }
    else if (percent > ledFullAt) {
      led.setColor(color);
    }
    else {
      var relRatio = (percent - ledEmptyAt) /
                     (ledFullAt - ledEmptyAt);
      led.setColor(black.towards(color, relRatio));
    }
  }
}

function cmd_rainbow(phase) {
  var leds = getOrderedLEDs();
  for (var i = 0; i < leds.length; i++) {
    var led = leds[i];
    var hue = (phase + 360 * i / leds.length) % 360;
    led.setColor(Chromath.hsv(hue, 1, 1));
  }
}

function cmd_gradient(from, to) {
  var leds = getOrderedLEDs();
  var colors = Chromath.gradient(from, to, leds.length);
  for (var i = 0; i < leds.length; i++) {
    var led = leds[i];
    var color = colors[i];
    led.setColor(color);
  }
}

function cmd_sweep(what) {
  var func;
  switch (what) {
    case 'rainbow':
      func = cmd_rainbow;
      break;
    case 'progress':
      func = function(phase) {
        var percent;
        if (phase < 180)
          percent = phase / 180 * 100;
        else
          percent = 100 - ((phase - 180) / 180) * 100;
        cmd_progress(percent, 'white');
      };
      break;
  }

  var phase = 0;
  setInterval(function() {
    func(phase);
    phase += 1;
    if (phase >= 360) {
      phase -= 360;
    }
  }, 10);
}

function main() {
  var program = require('commander');

  program
    .command('identify')
    .description('set each LED to a unique color and list them')
    .action(cmd_identify);

  /*
  program
    .command('define')
    .description('tell us the colors in the order you see them from identify ' +
                 'and we will write a config file to ' +
                 '~/.config/gaudy-leds/mapping')
    .action(cmd_define);
  */

  program
    .command('read')
    .description('show the RGB values of all LEDs')
    .action(cmd_read);


  program
    .command('all <color>')
    .description('set all LEDs to a single color')
    .action(cmd_all);

  program
    .command('set')
    .description('set all LEDs to a single color')
    .action(cmd_set);


  program
    .command('raw <r> <g> <b>')
    .description('set all LEDs to a single color using raw, unscaled rgb vals')
    .action(cmd_raw);

  program
    .command('progress <percent> <color>')
    .description('set all LEDs to a single color using raw, unscaled rgb vals')
    .action(cmd_progress);

  program
    .command('rainbow')
    .description('set the array to a rainbow based on the defined order')
    .action(cmd_rainbow.bind(null, 0));

  program
    .command('gradient <c1> <c2>')
    .description('set the array to a gradient between two colors')
    .action(cmd_gradient);

  program
    .command('sweep <what>')
    .description('animate a static pattern like rainbow across the lights')
    .action(cmd_sweep);

  program.parse(process.argv);
}
main();


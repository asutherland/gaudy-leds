Control usbled devices via node.js on linux, specifically Dream Cheeky webmail
notifier devices (http://www.dreamcheeky.com/webmail-notifier) like you might
purchase at ThinkGeek or other random gadget places.

We use libudev to find the devices and their sysfs exposed paths to control
them.  An alternate implementation would have been to use libusb directly.


In order for this to work on your system, you need to set the permissions up
correctly.  If you put udev-files/99-usblamp.rules in your /etc/udev/rules.d
and put udev-files/symlink-usblamp.sh in /etc/udev, then you should be good to
go.  Well, you may also want to invoke `udevadm trigger --action=change` to
force the changes to apply without you manually having to re-plug things.
Many thanks to the post at http://cweiske.de/tagebuch/usblamp-monitoring.htm.

Control usbled devices via node.js on linux, specifically Dream Cheeky webmail
notifier devices (http://www.dreamcheeky.com/webmail-notifier) like you might
purchase at ThinkGeek or other random gadget places.

We use libudev to find the devices and their sysfs exposed paths to control
them.  An alternate implementation would have been to use libusb directly.

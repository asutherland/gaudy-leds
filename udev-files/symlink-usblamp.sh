#!/bin/sh
path=/sys$DEVPATH
chmod g+w $path/red $path/green $path/blue
chgrp plugdev $path/red $path/green $path/blue

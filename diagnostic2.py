import gi
gi.require_version('WebKit2', '4.0')
from gi.repository import WebKit2
print(f'WebKit2 version: {WebKit2.get_major_version()}.{WebKit2.get_minor_version()}')
print('WebKit2 successfully imported!')
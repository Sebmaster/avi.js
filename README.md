avi.js
===
simple javascript AVI encoder
---

avi.js makes it possible to generate avi files in pure javascript. I try to keep the api as simple as possible.

API
---

	AVIJS()

AVIJS is the basic constructor. One avi file is one instance of AVIJS.

	AVIJS.prototype.settings

Settings is an object you can set which contains the following members:

* width
* height

<!-- -->

	AVIJS.prototype.streams

An array of all streams in the avi.

	AVIJS.prototype.getBuffer()

Returns a Blob which contains the header information and all contained streams making it a full avi file.
This can be used with the HTML5 FileSaver API for example.

	AVIJS.Stream(fps, width, height)

An avi file consists of multiple streams. The library is currently not intended for multi-stream avis so you most likely have to instance this just once.

* fps is the frames per seconds of the video

The other values should be self-explanatory.

	AVIJS.Stream.prototype.addRGBAFrame(frame)

For every frame you want to play back you can call this method once.

* frame is an array consisting of width * height * 4 pixels. This is for example the format of the return value of getImageData of a 2d canvas.


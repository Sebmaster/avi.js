"use strict";

(function() {
	
	/**
	 * A simple buffer to abstract data types away
	 * 
	 * @constructor
	 * @param {Array.<number>=} arr 
	 */
	function Buffer(arr) {
		this.buffer = arr ? arr : [];
		
	}
	Object.defineProperty(Buffer.prototype, 'length', {get: function() { return this.buffer.length; },
	                               		   			   enumerable : false}); 
	/**
	 * @param {Array.<number>} arr 
	 */
	Buffer.prototype.appendArray = function(arr) {
		for (var i=0; i < arr.length; ++i) {
			this.buffer.push(arr[i]);
		}
	};
	
	/**
	 * @param {number} idx
	 * @param {number} num 
	 */
	Buffer.prototype.writeShort = function(idx, num) {
		this.buffer[idx] = num & 255;
		this.buffer[idx + 1] = (num >> 8) & 255;
	};
	
	/**
	 * @param {number} idx
	 * @param {number} num 
	 */
	Buffer.prototype.writeInt = function(idx, num) {
		this.buffer[idx] = num & 255;
		this.buffer[idx + 1] = (num >> 8) & 255;
		this.buffer[idx + 2] = (num >> 16) & 255;
		this.buffer[idx + 3] = (num >> 24) & 255;
	};
	
	/**
	 * @param {number} idx
	 * @param {string} str 
	 */
	Buffer.prototype.writeString = function(idx, str) {
		for (var i=0; i < str.length; ++i) {
			this.buffer[idx + i] = str.charCodeAt(i) & 255;
		}
	};
	
	/**
	 * @param {number} idx
	 * @param {Buffer} buf 
	 */
	Buffer.prototype.writeBuffer = function(idx, buf) {
		var len = buf.length;
		var myBuf = this.buffer;
		var remBuf = buf.buffer;
		for (var i=0; i < len;) {
			myBuf[idx++] = remBuf[i++];
		}
	};
	
	/**
	 * @constructor
	 * @param {string} id
	 */
	function Chunk(id) {
		this.id = id;
		this.data = new Buffer();
	};

	Chunk.prototype.getBuffer = function() {
		var buffer = new Buffer();
		buffer.writeString(0, this.id);
		buffer.writeBuffer(8, this.data);
		if (this.data.length % 2 == 0) {
			buffer.writeInt(4, this.data.length);
		} else {
			buffer.writeInt(4, this.data.length + 1);
			buffer.appendArray([0]);
		}
		return buffer;
	};
	
	/**
	 * @constructor
 	 * @param {string} type
	 */
	function List(type) {
		this.type = type;
		this.elements = [];
	};
	
	List.prototype.getBuffer = function() {
		var buffer = new Buffer();
		buffer.writeString(0, 'LIST');
		buffer.writeString(8, this.type);
		
		var len = 4;
		for (var i=0; i < this.elements.length; ++i) {
			var buf = this.elements[i].getBuffer();
			buffer.writeBuffer(len + 8, buf);
			len += buf.length;
		}
		
		buffer.writeInt(4, len);
		return buffer;
	};
	
	/**
	 * @constructor 
	 */
	function AVIJS() {
		this.settings = {
			width: 0,
			height: 0
		};
		
		this.streams = [];
	};
	
	AVIJS.prototype.getBuffer = function() {
		var buffer = new Buffer();
		buffer.writeString(0, 'RIFF');
		buffer.writeString(8, 'AVI ');
		var len = 4;
		var frames = 0;
		for (var i=0; i < this.streams.length; ++i) {
			frames += this.streams[i].frames.length;
		}
		
		var hdrl = new List('hdrl');
		var avih = new Chunk('avih');
		avih.data.writeInt(0, 66665);
		avih.data.writeInt(4, 0); // MaxBytesPerSec
		avih.data.writeInt(8, 2); // Padding (in bytes)
		avih.data.writeInt(12, 0); // Flags
		avih.data.writeInt(16, frames); // Total Frames
		avih.data.writeInt(20, 0); // Initial Frames
		avih.data.writeInt(24, this.streams.length); // Total Streams
		avih.data.writeInt(28, 0); // Suggested Buffer size
		avih.data.writeInt(32, this.settings.width); // pixel width
		avih.data.writeInt(36, this.settings.height); // pixel height
		avih.data.writeInt(40, 0); // Reserved int[4]
		avih.data.writeInt(44, 0);
		avih.data.writeInt(48, 0);
		avih.data.writeInt(52, 0);
		hdrl.elements.push(avih);
		
		for (var i=0; i < this.streams.length; ++i) {
			hdrl.elements.push(this.streams[i].getHeaderBuffer());
		}
		var hdrlBuf = hdrl.getBuffer();
		buffer.writeBuffer(8 + len, hdrlBuf);
		len += hdrlBuf.length;
		
		var movi = new List('movi');
		for (var i=0; i < this.streams.length; ++i) {
			movi.elements.push.apply(movi.elements, this.streams[i].getDataBuffer(i));
		}
		
		var moviBuf = movi.getBuffer();
		buffer.writeBuffer(8 + len, moviBuf);
		len += moviBuf.length;
		
		buffer.writeInt(4, len);
		var blob = new BlobBuilder();
		blob.append((new Uint8Array(buffer.buffer)).buffer);
		return blob.getBlob('video/avi');
	};
	
	/**
	 * @constructor
 	 * @param {number} fps
	 */
	AVIJS.Stream = function(fps, width, height) {
		this.fps = fps;
		this.width = width;
		this.height = height;
		this.frames = [];
	};
	
	AVIJS.Stream.prototype.addRGBAFrame = function(imgData) {
		var frame = [];
		for (var i=0; i < imgData.length; i += 4) {
			frame.push(imgData[i+1], imgData[i+2], imgData[i]);
		}
		this.frames.push(frame);
	};
	
	AVIJS.Stream.prototype.getHeaderBuffer = function() {
		var list = new List('strl');
		var strh = new Chunk('strh');
		strh.data.writeString(0, 'vids'); // fourCC
		strh.data.writeString(4, 'DIB '); // Uncompressed
		strh.data.writeInt(8, 0); // Flags
		strh.data.writeShort(12, 1); // Priority
		strh.data.writeShort(14, 0); // Language
		strh.data.writeInt(16, 0); // Initial frames
		strh.data.writeInt(20, 1); // Scale
		strh.data.writeInt(24, this.fps); // Rate
		strh.data.writeInt(28, 0); // Startdelay
		strh.data.writeInt(32, this.frames.length); // Length
		strh.data.writeInt(36, this.width * this.height * 3); // suggested buffer size
		strh.data.writeInt(40, -1); // quality
		strh.data.writeInt(44, 0); // sampleSize
		strh.data.writeShort(48, 0); // Rect left
		strh.data.writeShort(50, 0); // Rect top
		strh.data.writeShort(52, this.width); // Rect width
		strh.data.writeShort(54, this.height); // Rect height
		list.elements.push(strh);
		
		var strf = new Chunk('strf');
		strf.data.writeInt(0, 40); // struct size
		strf.data.writeInt(4, this.width); // width
		strf.data.writeInt(8, -this.height); // height
		strf.data.writeShort(12, 1); // planes
		strf.data.writeShort(14, 24); // bits per pixel
		strf.data.writeInt(16, 0); // compression
		strf.data.writeInt(20, 0); // image size
		strf.data.writeInt(24, 0); // x pixels per meter
		strf.data.writeInt(28, 0); // y pixels per meter
		strf.data.writeInt(32, 0); // colortable used
		strf.data.writeInt(36, 0); // colortable important
		list.elements.push(strf);
		
		return list;
	};
	
	AVIJS.Stream.prototype.getDataBuffer = function(idx) {
		var chunks = [];
		for (var i=0; i < this.frames.length; ++i) {
			var chk = new Chunk((idx < 10 ? '0' + idx : idx) + 'db');
			chk.data.appendArray(this.frames[i]);
			chunks.push(chk);
		}
		return chunks;
	};
	
	window['AVIJS'] = AVIJS;
})();
"use strict";

/**
 *   avi.js is a javascript avi encoder
 *   @license Copyright (C) 2012 Sebastian Mayr
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program.  If not, see <http://www.gnu.org/licenses/>. 
 */

(function() {
	
	/**
	 * @param {Uint8Array} buf
	 * @param {number} idx
	 * @param {Array.<number>} bytes 
	 */
	function writeBytes(buf, idx, bytes) {
		for (var i=0; i < bytes.length; ++i) {
			buf[idx + i] = bytes[i];
		}
	}
	
	/**
	 * @param {Uint8Array} buf
	 * @param {number} idx
	 * @param {number} num 
	 */
	function writeShort(buf, idx, num) {
		buf[idx] = num & 255;
		buf[idx + 1] = (num >> 8) & 255;
	}
	
	/**
	 * @param {Uint8Array} buf
	 * @param {number} idx
	 * @param {number} num 
	 */
	function writeInt(buf, idx, num) {
		buf[idx] = num & 255;
		buf[idx + 1] = (num >> 8) & 255;
		buf[idx + 2] = (num >> 16) & 255;
		buf[idx + 3] = (num >> 24) & 255;
	}
	
	/**
	 * @param {number} idx
	 * @param {number} num 
	 */
	function writeLong(buf, idx, num) {
		buf[idx] = num & 255;
		buf[idx + 1] = (num >> 8) & 255;
		buf[idx + 2] = (num >> 16) & 255;
		buf[idx + 3] = (num >> 24) & 255;
		buf[idx + 4] = 0;
		buf[idx + 5] = 0;
		buf[idx + 6] = 0;
		buf[idx + 7] = 0;
	};
	
	/**
	 * @param {number} idx
	 * @param {string} str 
	 */
	function writeString(buf, idx, str) {
		for (var i=0; i < str.length; ++i) {
			buf[idx + i] = str.charCodeAt(i) & 255;
		}
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
	
	AVIJS.prototype.getHeaderLength = function() {
		return 12 /* RIFF */ + 12 /* hdrl */ + 8 /* avih */ + 56 /* struct */ + 12 /* movi */;
	};
	
	AVIJS.prototype.getLength = function() {
		var len = this.getHeaderLength();
		for (var i=0; i < this.streams.length; ++i) {
			len += this.streams[i].getHeaderLength() + this.streams[i].getDataLength();
		}
		return len;
	};
	
	AVIJS.prototype.getBuffer = function() {
		var dataOffset = {};
		var offset = 0;
		var frames = 0;
		var streamHeaderLength = 0;
		for (var i=0; i < this.streams.length; ++i) {
			frames += this.streams[i].frames.length;
			streamHeaderLength += this.streams[i].getHeaderLength();
			dataOffset[i] = offset;
			offset += this.streams[i].getDataLength();
		}
		var moviOffset = this.getHeaderLength() + streamHeaderLength;
		
		var buffer = new Uint8Array(moviOffset + offset);
		writeString(buffer, 0, 'RIFF');
		writeString(buffer, 8, 'AVI ');
		
		writeString(buffer, 12, 'LIST');
		writeInt(buffer, 16, 68 + streamHeaderLength);
		writeString(buffer, 20, 'hdrl'); // hdrl list
		writeString(buffer, 24, 'avih'); // avih chunk
		writeInt(buffer, 28, 56); // avih size
		
		writeInt(buffer, 32, 66665);
		writeInt(buffer, 36, 0); // MaxBytesPerSec
		writeInt(buffer, 40, 2); // Padding (in bytes)
		writeInt(buffer, 44, 0); // Flags
		writeInt(buffer, 48, frames); // Total Frames
		writeInt(buffer, 52, 0); // Initial Frames
		writeInt(buffer, 56, this.streams.length); // Total Streams
		writeInt(buffer, 60, 0); // Suggested Buffer size
		writeInt(buffer, 64, this.settings.width); // pixel width
		writeInt(buffer, 68, this.settings.height); // pixel height
		writeInt(buffer, 72, 0); // Reserved int[4]
		writeInt(buffer, 76, 0);
		writeInt(buffer, 80, 0);
		writeInt(buffer, 84, 0);
		
		var len = 88;
		offset = 0;
		for (var i=0; i < this.streams.length; ++i) {
			len += this.streams[i].writeHeaderBuffer(buffer.subarray(88 + offset), i, moviOffset + dataOffset[i]);
		}
		
		writeString(buffer, len, 'LIST');
		writeString(buffer, len + 8, 'movi');
		
		var moviLen = 4;
		for (var i=0; i < this.streams.length; ++i) {
			moviLen += this.streams[i].writeDataBuffer(buffer.subarray(len + 8 + moviLen), i);
		}
		writeInt(buffer, len + 4, moviLen);

		writeInt(buffer, 4, len + moviLen);
		
		var blob;
		try {
			blob = new Blob([buffer.buffer], { 'type' : 'video/avi' });
		} catch (e) {
			var builder = new (typeof BlobBuilder !== 'undefined' ? BlobBuilder : WebKitBlobBuilder)();
			builder.append(buffer.buffer);
			blob = builder.getBlob('video/avi');
		}
		
		return blob;
	};
	
	/**
	 * @constructor
 	 * @param {number} fps
 	 * @param {number} width
 	 * @param {number} height
	 */
	AVIJS.Stream = function(fps, width, height) {
		this.fps = fps;
		this.width = width;
		this.height = height;
		this.frames = [];
	};
	
	AVIJS.Stream.prototype.addRGBAFrame = function(imgData) {
		var frame = new Uint8Array(imgData.length);
		for (var i=0; i < frame.length; i += 4) {
			frame[i] = imgData[i + 2];
			frame[i + 1] = imgData[i + 1];
			frame[i + 2] = imgData[i];
		}
		this.frames.push(frame);
	};
	
	AVIJS.Stream.prototype.getHeaderLength = function() {
		return 12 /* strl */ + 8 /* strh */ + 56 /* struct */ + 8 /* strf */ + 40 /* struct */ + 8 /* indx */ + 24 /* struct */ + this.frames.length * 4 * 2;
	};
	
	AVIJS.Stream.prototype.getDataLength = function() {
		var len = 0;
		for (var i=0; i < this.frames.length; ++i) {
			len += 8 + this.frames[i].length + (this.frames[i].length % 2 == 0 ? 0 : 1); // Pad if chunk not in word boundary
		}
		return len;
	};
	
	AVIJS.Stream.prototype.writeHeaderBuffer = function(buf, idx, dataOffset) {
		writeString(buf, 0, 'LIST');
		writeInt(buf, 4, 148 + this.frames.length * 4 * 2);
		writeString(buf, 8, 'strl');
		writeString(buf, 12, 'strh');
		writeInt(buf, 16, 56);
		writeString(buf, 20, 'vids'); // fourCC
		writeString(buf, 24, 'DIB '); // Uncompressed
		writeInt(buf, 28, 0); // Flags
		writeShort(buf, 32, 1); // Priority
		writeShort(buf, 34, 0); // Language
		writeInt(buf, 36, 0); // Initial frames
		writeInt(buf, 40, 1); // Scale
		writeInt(buf, 44, this.fps); // Rate
		writeInt(buf, 48, 0); // Startdelay
		writeInt(buf, 52, this.frames.length); // Length
		writeInt(buf, 56, this.width * this.height * 4 + 8); // suggested buffer size
		writeInt(buf, 60, -1); // quality
		writeInt(buf, 64, 0); // sampleSize
		writeShort(buf, 68, 0); // Rect left
		writeShort(buf, 70, 0); // Rect top
		writeShort(buf, 72, this.width); // Rect width
		writeShort(buf, 74, this.height); // Rect height
		
		writeString(buf, 76, 'strf');
		writeInt(buf, 80, 40);
		writeInt(buf, 84, 40); // struct size
		writeInt(buf, 88, this.width); // width
		writeInt(buf, 92, -this.height); // height
		writeShort(buf, 96, 1); // planes
		writeShort(buf, 98, 32); // bits per pixel
		writeInt(buf, 100, 0); // compression
		writeInt(buf, 104, 0); // image size
		writeInt(buf, 108, 0); // x pixels per meter
		writeInt(buf, 112, 0); // y pixels per meter
		writeInt(buf, 116, 0); // colortable used
		writeInt(buf, 120, 0); // colortable important
		
		writeString(buf, 124, 'indx');
		writeInt(buf, 128, 24 + this.frames.length * 4 * 2); // size
		writeShort(buf, 132, 2); // LongsPerEntry
		writeBytes(buf, 134, [0, 0x01]); // indexSubType + indexType
		writeInt(buf, 136, this.frames.length); // numIndexEntries
		writeString(buf, 140, (idx < 10 ? '0' + idx : idx) + 'db'); // chunkID
		writeLong(buf, 144, dataOffset); // data offset
		writeInt(buf, 152, 0); // reserved
		
		var offset = 0;
		for (var i=0; i < this.frames.length; ++i) { // index entries
			writeInt(buf, 156 + i * 8, offset); // offset
			writeInt(buf, 160 + i * 8, this.frames[i].length + 8); // size
			offset += this.frames[i].length + 8;
		}
		
		return 156 + this.frames.length * 4 * 2;
	};
	
	AVIJS.Stream.prototype.writeDataBuffer = function(buf, idx) {
		var len = 0;
		for (var i=0; i < this.frames.length; ++i) {
			writeString(buf, len, (idx < 10 ? '0' + idx : idx) + 'db');
			writeInt(buf, len + 4, this.frames[i].length);
			writeBytes(buf, len + 8, this.frames[i]);
			len += this.frames[i].length + 8;
		}
		return len;
	};
	
	var scope = new Function('return this')();
	
	if (typeof WorkerLocation !== 'undefined' && scope.location instanceof WorkerLocation) {
		var avi = new AVIJS();
		
		scope.onmessage = function(evt) {
			switch (evt.data.action) {
				case 'settings':
					avi.settings = evt.data.settings;
					break;
				case 'stream':
					avi.streams.push(new AVIJS.Stream(evt.data.fps, evt.data.width, evt.data.height));
					break;
				case 'frameImageData':
					avi.streams[evt.data.stream].addRGBAFrame(evt.data.frame.data);
					break;
				case 'buffer':
					scope.postMessage(avi.getBuffer());
					break;
			}
		};
	} else {
		scope['AVIJS'] = AVIJS;
	}
})();
// Jean Luc Biellmann - contact@alsatux.com - 20140410 - v0.5

var _Log = {
	clear: function () {
		document.getElementById('log').innerHTML = '';
	},
	push: function (mess, className='') {
		document.getElementById('log').innerHTML += '<p' + (className.length ? ' class="' + className + '"' : '') + '>' + mess + '</p>';
	},
	info: function (mess) {
		_Log.push(mess, 'info');
	},
	warn: function (mess) {
		_Log.push(mess, 'warn');
	},
	error: function (mess) {
		_Log.push(mess, 'error');
	}
};

var _Storage  = {
	add: function (device, blobdata, blobtype, filename) {
		var blob = new Blob([blobdata], {type: blobtype});
		var storage = navigator.getDeviceStorage(device);
		var req = storage.addNamed(blob, filename);
		req.onsuccess = function () {
			_Log.info('File '+ filename + ' has been written to SD card !');
		}
		req.onerror = function () {
			_Log.error('Unable to write '+ filename + ' to SD card ! USB not unplugged ?');
		}
	}
};

var _DataURL = {
	decode2Uint8Array: function (data) {
		// decode a base64 string
		var binary = atob(data);
		// create an array of byte values where each element will be the value of the byte
		var buffer = [];
		for (var i=0;i<binary.length;i++)
			// charCodeAt() method returns the Unicode of the character at the specified index in a string. (H -> 72)
			buffer.push(binary.charCodeAt(i));
		// convert the array of byte values into a real typed byte array
		return new Uint8Array(buffer);
	}
};

var _C2XML = {

	date: null,
	cb1: true,
	cb2: true,
	photoindex: {},

	twoDigits: function (value) {
		return (value<10 ? '0' : '') + value;
	},

	init: function () {
		var but1 = document.getElementById('but1');
		but1.addEventListener("click", _C2XML.backup);
		var but2 = document.getElementById('but2');
		but2.addEventListener("click", _C2XML.reset);
		_C2XML.reset();
	},
	
	reset: function () {
		_Log.clear();
		document.getElementById('part1').style.display = 'block';
		document.getElementById('but2').style.display = 'none';
		window.scrollTo(0,0);
	},

	finished: function () {
		document.getElementById('but2').style.display = '';
		_Log.warn('That\'s all, folks !');
	},
	
	backup: function () {
		_C2XML.cb1 = document.getElementById('cb1').checked;
		_C2XML.cb2 = document.getElementById('cb2').checked;
		document.getElementById('part1').style.display = 'none';
		document.getElementById('count').style.display = '';
		_Log.clear();
		_Log.warn('Retrieving all contacts...');
		_Log.info('Please be patient ...');
		var count = document.getElementById('count');
		count.innerHTML = '';

		// set date
		var d = new Date();
		var yyyy = d.getFullYear();
		var mm = _C2XML.twoDigits(d.getMonth() + 1);
		var dd = _C2XML.twoDigits(d.getDate());
		var hh = _C2XML.twoDigits(d.getHours());
		var ii = _C2XML.twoDigits(d.getMinutes());
		var ss = _C2XML.twoDigits(d.getSeconds());
		_C2XML.date = yyyy + mm + dd + hh + ii + ss;

		_C2XML.photoindex = {};

		var markup = '<?xml version="1.0" encoding="UTF-8"?><mozcontacts></mozcontacts>';
		var xmldoc = (new DOMParser()).parseFromString(markup, 'application/xml');
		var xmlroot = xmldoc.getElementsByTagName("mozcontacts")[0];

		var req = navigator.mozContacts.getAll({});
		var i = 0;
		req.onsuccess = function() {
			if (req.result) {
				var xmlnode = xmldoc.createElement('contact');
				xmlroot.appendChild(xmlnode);
				count.innerHTML = 'Contact N°' + (++i) + '...';
				_C2XML.export(xmldoc, xmlnode, req.result, null);
				req.continue();
			} else {
				count.innerHTML = '';
				_Log.warn(i + ' contacts found !');
				var blobdata = (new XMLSerializer()).serializeToString(xmldoc);
				_Storage.add('sdcard', blobdata, 'text/plain', 'contacts2xml/' + _C2XML.date + '.xml');
				_Storage.add('sdcard', blobdata, 'text/plain', 'contacts2xml/' + _C2XML.date + '.xml.bak');
				// XML output was removed because photos took too many memory...
				//result.innerHTML = ('<p>XML datas:</p>' + blobdata.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'));
				_Log.warn('XML size: ' + blobdata.length + ' bytes.');
				_C2XML.finished();
			}
		}
		req.onerror = function() {
			_Log.error('<p>Error getting contacts ! Program aborted !</p>');
			_C2XML.finished();
		}
	},

	export: function (xmldoc, xmlroot, contact, parent) {
		if (xmlroot.nodeName=='photo') {
			// File inherits from Blob
			var reader = new FileReader();
			reader.onload = function (e) {
				// reader.result - data:application/octet-stream
				if (_C2XML.cb1) { 
					// add data-uris to XML
					var xmltext = xmldoc.createTextNode('data:image/jpeg;base64,' + reader.result.split(',')[1]);
					xmlroot.appendChild(xmltext);
				}
				if (_C2XML.cb2) { 
					// export photos as jpg
					var blobdata = _DataURL.decode2Uint8Array(reader.result.split(',')[1]);
					var id = parent['id'];
					_C2XML.photoindex[id] = (!(id in _C2XML.photoindex) ? 1 : _C2XML.photoindex[id]+1);
					_Storage.add('sdcard', blobdata, 'image/jpeg', 'contacts2xml/' + _C2XML.date + '/' + parent['id'] + '.' + _C2XML.photoindex[id] + '.jpg');
				}
			}
			reader.readAsDataURL(contact);
		} else {
			for (var key in contact) {
				if (contact[key]!==null && contact[key]!==undefined) {
					if (typeof(contact[key])=='string') {
						var xmlnode = xmldoc.createElement(key);
						xmlroot.appendChild(xmlnode);
						var xmltext = xmldoc.createTextNode(contact[key]);
						xmlnode.appendChild(xmltext);
					} else { // object
						if (contact[key].constructor != Array) {
							var xmlnode = xmldoc.createElement(key);
							xmlroot.appendChild(xmlnode);
							_C2XML.export(xmldoc, xmlnode, contact[key], contact);
						} else { // array
							if (contact[key].length) {
								if (typeof(contact[key][0])=='string') {
									for (var i=0;i<contact[key].length;i++) {
										var xmlnode = xmldoc.createElement(key);
										xmlroot.appendChild(xmlnode);
										var xmltext = xmldoc.createTextNode(contact[key][i]);
										xmlnode.appendChild(xmltext);
									}
								} else {
									for (var i=0;i<contact[key].length;i++) {
										var xmlnode = xmldoc.createElement(key);
										xmlroot.appendChild(xmlnode);
										_C2XML.export(xmldoc, xmlnode, contact[key][i], contact);
									}
								}
							}
						}
					}
				}
			}
		}
	}
};

window.onload = function () {
	_C2XML.init();
}


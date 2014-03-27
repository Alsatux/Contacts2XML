// Jean Luc Biellmann - contact@alsatux.com - 20140226 - v0.4

var _Log = {
	clear: function () {
		var div = document.getElementById('log');
		div.innerHTML = '';
	},
	info: function (mess, clear=false) {
		var div = document.getElementById('log');
		div.innerHTML += '<p>' + mess + '</p>';
	},
	error: function (mess, clear=false) {
		var div = document.getElementById('log');
		div.innerHTML += '<p style="color:red">' + mess + '</p>';
	},
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
	toArrayBuffer: function (data) {
		var binary = atob(data.split(',')[1]);
		var buffer = [];
		for (var i=0;i<binary.length;i++)
			buffer.push(binary.charCodeAt(i));
		return new Uint8Array(buffer);
	}
};

var _C2XML = {

	date: null,

	twoDigits: function (value) {
		return (parseInt(value,10)<10 ? '0' : '') + value;
	},

	init: function () {
		_Log.clear();
		var but1 = document.getElementById('but1');
		but1.addEventListener("click", _C2XML.backup);
	},

	backup: function () {
		_Log.clear();
		_Log.info('Retrieving all contacts... Please be patient !');
		var count = document.getElementById('count');
		count.innerHTML = '';
		var result = document.getElementById('result');
		result.innerHTML = '';

		// set date
		var d = new Date();
		var yyyy = d.getFullYear();
		var mm = _C2XML.twoDigits(d.getMonth() + 1);
		var dd = _C2XML.twoDigits(d.getDate());
		var hh = _C2XML.twoDigits(d.getHours());
		var ii = _C2XML.twoDigits(d.getMinutes());
		var ss = _C2XML.twoDigits(d.getSeconds());
		_C2XML.date = yyyy + mm + dd + hh + ii + ss;

		var markup = '<?xml version="1.0" encoding="UTF-8"?><mozcontacts></mozcontacts>';
		var xmldoc = (new DOMParser()).parseFromString(markup, 'application/xml');
		var xmlroot = xmldoc.getElementsByTagName("mozcontacts")[0];

		var req = navigator.mozContacts.getAll({});
		var i = 1;
		req.onsuccess = function() {
			if (req.result) {
				var xmlnode = xmldoc.createElement('contact');
				xmlroot.appendChild(xmlnode);
				count.innerHTML = 'Contact N°' + (i++) + '...';
				_C2XML.export(xmldoc, xmlnode, req.result, null);
				req.continue();
			} else {
				count.innerHTML = '';
				_Log.info(i + ' contacts found !');
				var blobdata = (new XMLSerializer()).serializeToString(xmldoc);
				_Storage.add('sdcard', blobdata, 'text/plain', 'contacts2xml/' + _C2XML.date + '.xml');
				_Storage.add('sdcard', blobdata, 'text/plain', 'contacts2xml/' + _C2XML.date + '.xml.bak');
				result.innerHTML = ('<p>XML datas:</p>' + blobdata.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'));
			}
		}
		req.onerror = function() {
			_Log.error('<p>Error getting contacts ! Program aborted !</p>');
		}
	},

	export: function (xmldoc, xmlroot, contact, parent) {
		if (xmlroot.nodeName=='photo') {
			// File inherits from Blob
			var reader = new FileReader();
			reader.onload = function (e) {
				var blobdata = _DataURL.toArrayBuffer(reader.result);
				_Storage.add('sdcard', blobdata, 'image/jpg', 'contacts2xml/' + _C2XML.date + '/' + parent['id'] + '.jpg');
			}
			// reader.readAsArrayBuffer(contact); // should work - v1.1 bug ?!
			reader.readAsDataURL(contact); // data:application/octet-stream:...
		} else {
			for (var key in contact) {
				if (key!=undefined && contact[key]!=undefined) {
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

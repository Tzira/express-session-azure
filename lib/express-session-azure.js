/* AzureSessionStore
    License: MIT
    Description: An express session store using Azure Storage Tables.
*/

var azure = require('azure-storage'),
	entGen = azure.TableUtilities.entityGenerator,
	util = require(process.binding('natives').util ? 'util' : 'sys'),
	Session = require('express-session');

var TABLE_NAME = 'TBLAPISESSIONS',
	PARTITION_KEY = 'PKSESSIONS';


module.exports = AzureSessionStore;

function AzureSessionStore(options) {
    this.config = options || {};
    Session.Store.call(this, options);

    this.table = azure.createTableService(this.config.name, this.config.accessKey);
}

util.inherits(AzureSessionStore, Session.Store);

var p = AzureSessionStore.prototype;

p.get = function(sid, callback) {
	console.log('AzureSessionStore.get: ' + sid);
	var self = this;
	this.table.retrieveEntity(TABLE_NAME, PARTITION_KEY, sid, function(err, result) {
		if (err) {
			console.log('AzureSessionStore.get: ' + err);
			if (err.code == 'ResourceNotFound') {
				callback();
			}
			else if (err.code == 'TableNotFound') {
				self.table.createTableIfNotExists(TABLE_NAME, function(err) {
					if (err) {
						console.log('AzureSessionStore.get.createTableIfNotExists: ' + err);
					}
					console.log('AzureSessionStore.set: table created successfully');
					self.get(sid, callback);
				});
			}
			else {
				callback(err);
			}
		}
		else {
			var info = {};
			for (var k in result) {
				if (k === 'PartitionKey' ||
					k === 'RowKey' ||
					k === 'Timestamp' ||
					k === '.metadata') {
					continue;
				}
				
				var v = result[k]._;
				if (typeof v === 'string' && v.indexOf('{') === 0) {
					try {
						info[k] = JSON.parse(v);                        
					}
					catch (ex)
					{
						console.log('AzureSessionStore.get.parse: ' + ex.toString());
					}
				}
				else if (typeof v !== 'undefined') {
					info[k] = v;
				}
			}
//			console.log('------------------------------------------');
//			console.dir(info);
//			console.log('------------------------------------------');
			console.log('AzureSessionStore.get SUCCESS: ' + sid);
			callback(null, info);
		}
	});
}

p.set = function(sid, session, callback) {
	console.log('AzureSessionStore.set: ' + sid);
	
	var enty = {
		PartitionKey : entGen.String(PARTITION_KEY),
		RowKey : entGen.String(sid)
	}
	
	for (var k in session) {
	    if (k.indexOf("_") === 0) {
	    	continue;	// do not copy "private" properties
	    }
	    
	    var v = session[k],
	    	t = typeof v;
	    
	    switch (t) {
	    	case 'string':
	    	case 'number':
	    		enty[k] = entGen.String(v);
	    		break;
	    	case 'object':
	    		enty[k] = entGen.String(JSON.stringify(v));
	    		break;
	    	default:
	    		break;
	    }
	}
	
//	console.dir(enty);
	var self = this;
	this.table.insertOrReplaceEntity(TABLE_NAME, enty, function(err, results) {
		if (err) {
			console.log('AzureSessionStore.set: ' + err);
			if (err.code == 'TableNotFound') {
				self.table.createTableIfNotExists(TABLE_NAME, function(err){
					if (err) {
						console.log('AzureSessionStore.set.createTableIfNotExists: ' + err);
					}
					console.log('AzureSessionStore.set: table created successfully');
					self.set(sid, session, callback);
				});
			}
			else {
				callback(err.toString(), null);
			}
		}
		else {        
			console.log('AzureSessionStore.set SUCCESS: ' + sid);
			callback(null, session);
		}
	});
}

p.touch = function(sid, session, callback) {
	console.log('AzureSessionStore.touch: ' + sid);
//	console.dir(session);
	
	this.set(sid, session, callback);
}

p.destroy = function(sid, callback) {
	console.log('AzureSessionStore.destroy: ' + sid);
	var enty = {
			PartitionKey : entGen.String(PARTITION_KEY),
			RowKey : entGen.String(sid)
		};
	this.table.deleteEntity(TABLE_NAME, enty, function(err) {
		if (err) {
			console.log('AzureSessionStore.destroy: ' + err);
		}
        
		callback();
	});
}

p.length = function(callback) {
	console.log('AzureSessionStore.length:');
	this.table.queryEntities(TABLE_NAME, null, null, function(error, result) {
		if (error) {
			callback(error, null);
		}
		else {
			callback(null, result.entries.length);
		}
	});
}

p.clear = function(callback) {
	console.log('AzureSessionStore.clear:');
	
	var self = this;
	
	this.table.queryEntities(TABLE_NAME, null, null, function(error, result) {
		if (error) {
			console.log(error);
			callback(error);
		}
		else {
			console.log(result.entries.length);
			clearExpiredSessions(this.table, result.entries, 0, function(err, count)  {
				console.log(err, count);
			});
		}
	});
}

function clearExpiredSessions(table, sessions, deleteCount, callback) {
	console.log('AzureSessionStore.clearExpiredSessions:');
	
	var now = new Date(),
		session = sessions.shift(),
		self = this;
	
	if (session) {
		var cookie = JSON.parse(session.cookie._),
			cookieExpire = new Date(cookie.expires);
		if ((now - cookieExpire) > cookie.originalMaxAge) {
			table.deleteEntity(TABLE_NAME, {
					PartitionKey : entGen.String(PARTITION_KEY),
					RowKey : entGen.String(session.RowKey._)
				}, function(err) {
				if (err) {
					callback(err);
				}
				else {
					deleteCount++;
				}
				
				clearExpiredSessions(table, sessions, deleteCount, callback);
			});
		}
		else {
			clearExpiredSessions(table, sessions, deleteCount, callback);
		}
	}
	else {
		callback(null, deleteCount);
	}
}

p.on = function(cmd) {
	console.log('AzureSessionStore.on.' + cmd);
}
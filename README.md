# ExpressJS Session Store for Azure

Node.js express session store provider for Windows Azure table storage.


## Install

    npm install express-session-azure


## Usage

Typical usage for the most part:

    var express = require('express'),
	    session = require('express-session'),
        AzureSessionStore = require('express-session-azure'),

		sessionOpts = {
			name : 'your-app-name',
			secret : 'your-app-secret',
			resave : false,
			saveUninitialized : false,
			rolling : false,
			proxy : true,
			store : new AzureSessionStore({
				name: 'azure-storage-name',
				accessKey: 'azure-storage-key'
			}),
			cookie : {
				maxAge : 1800000,	// 30 min
				secure : false,
				httpOnly : true
			}
		};

    var app = express();
    app.use(session(sessionOpts));


## Performance

Leveraging Windows Azure Table Storage nets some impressive performance. Not the fastest session store,
but for being highly distributed and fault tolerant, it's an easy win. Latencies should be less than
20ms on average. Feel free to report your own findings.

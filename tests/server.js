


var express = require('express');
var app = express();
var path = require('path');
var ip = require( '../index' );

var port = process.env.PORT || 3000;

ip.debug( true );
app.use( '/ip', ip.middleware( {
    source: path.join( __dirname, '/images' ),
    destination: '/tmp/express-imageprinter-test',
    maxAge: 86400000 // one day
    } )
);

var imageScaler = ip.createHelper( '/ip' );
app.get( '/', function( req, res ) {
    var link = imageScaler( 'image.jpg', { width: 400, height: 200, crop:true } );
    res.send( 200, '<img src="'+link+'">Test image</img>' );
});

app.listen(port);
console.log('Listening on port ' + port );
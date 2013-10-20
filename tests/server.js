


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

ip.set( 'test', function( img, options ) {
    // Only seen when image is processed, not when served from cache
    console.log( 'called test operation' );
    img.resize( options.width, options.height);
} )

var imageScaler = ip.createHelper( '/ip' );
app.get( '/', function( req, res ) {
    var link = imageScaler( 'image.jpg', { width: 400, height: 200, crop:true } );
    var link2 = imageScaler( 'image.jpg', { width: 200, height: 200, op: 'test' } );

    res.send( 200, '<img src="'+link+'">Test image</img><br /><img src="'+link2+'"></img>' );
});

app.listen(port);
console.log('Listening on port ' + port );
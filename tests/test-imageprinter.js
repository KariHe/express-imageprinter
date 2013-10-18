

var should = require('should');
var assert = require('mocha');
var path = require( 'path' );

describe('Image printer', function() {
    var ip = require('../index');

    it('helper should encode parameters to uri', function() {
        var helper = ip.createHelper( '/ip' );
        var image = 'large/image.jpg';
        var options = { width: '200', height: '100', quality: '100', crop: 'true' };
        var uri = helper( image, options );

        uri.should.include( 'ip' );

        var resizeConfig = ip.parseRequest( uri );
//        console.log( uri );
//        console.log(resizeConfig);

        resizeConfig.should.be.instanceof( Object );
        resizeConfig.should.have.property( 'options' );
        resizeConfig.options.width.should.equal( options.width );
        resizeConfig.options.height.should.equal( options.height );
        resizeConfig.options.quality.should.equal( options.quality );
        resizeConfig.options.crop.should.equal( options.crop );
    });

    it('notice if cache file does not exist', function(done) {
        var options = {
           cacheFile: '/tmp/image__foo.jpg',
           source: path.join(__dirname, 'images', 'image.jpg'),
           options: {}
        }

//        ip.debug( true );
        ip.validateCache( options, function( err, cached ) {
            should.not.exists( err );
            cached.should.equal( false );
            done();
        });
    });

    it('should find valid cache file', function(done) {
        var options = {
            cacheFile: path.join(__dirname, 'images', 'image_exists.jpg'),
            source: path.join(__dirname, 'images', 'image.jpg'),
            options: {}
        }

        // ip.debug( true );
        ip.validateCache( options, function( err, cached ) {
            should.not.exists( err );
            cached.should.equal( true );
            done();
        });
    });


    it('should give error if source not exists', function(done) {
        var options = {
            cacheFile: path.join(__dirname, 'images', 'image_exists.jpg'),
            source: path.join(__dirname, 'images', 'not_exists.jpg'),
            options: {}
        }

        //ip.debug( true );
        ip.validateCache( options, function( err, cached ) {
            should.exists( err );
            done();
        });
    });

    it('should not accept empty cache file', function(done) {
        var options = {
            cacheFile: path.join(__dirname, 'images', 'zero.jpg'),
            source: path.join(__dirname, 'images', 'image.jpg'),
            options: {}
        }

        //ip.debug( true );
        ip.validateCache( options, function( err, cached ) {
            should.not.exists( err );
            cached.should.equal( false );
            done();
        });
    });

});
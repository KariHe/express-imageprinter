

var should = require('should');
var assert = require('mocha');
var path = require( 'path' );
var fs = require( 'fs' );
var gm = require( 'gm' );

describe('Image printer', function() {
    var ip = require('../index');

    //ip.debug( true );

    it('browser helper should create same uri', function() {
        var browserHelper = require('../imageprinter-helper' );

        var helper = ip.createHelper( '/ip' );
        var helper2 = browserHelper( '/ip' );

        var image = 'large/image.jpg';
        var options = { width: '200', height: '100', quality: '100', crop: 'true' };

        var uri = helper( image, options );
        var uri2 = helper2( image, options );

        uri.should.include( 'ip' );
        uri.should.equal( uri2 );

    });

    it('helper should encode parameters to uri', function() {
        var helper = ip.createHelper( '/ip' );
        var image = 'large/image.jpg';
        var options = { width: '200', height: '100', quality: '100', crop: 'true' };
        var uri = helper( image, options );

        uri.should.include( 'ip' );

        var resizeConfig = ip.parseRequest( uri );

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

        ip.validateCache( options.cacheFile, null, function( valid, modified ) {
            valid.should.equal( false );
            done();
        });
    });

    it('should find valid cache file', function(done) {
        var options = {
            cacheFile: path.join(__dirname, 'images', 'image_exists.jpg'),
            source: path.join(__dirname, 'images', 'image.jpg'),
            options: {}
        }

        ip.validateCache( options.cacheFile, null, function( valid, modified ) {
            valid.should.not.equal( false );
            done();
        });
    });


    it('should give error if source not exists', function(done) {
        var helper = ip.createHelper('');
        var link = helper( 'image_not_exist.jpg' );

        var config = {
            source: path.join( __dirname, '/images' ),
            destination: '/tmp/express-imageprinter-test'
        };
        var middleware = ip.middleware( config );
        var req = { path: link };
        var res = {
            send: function( code, message ) {
                code.should.be.equal( 404 );
                done();
            }
        };
        middleware( req, res, function( err ) {
            assert( false, 'should not be here');
        });
    });

    it('should not accept empty cache file', function(done) {
        var options = {
            cacheFile: path.join(__dirname, 'images', 'zero.jpg'),
            source: path.join(__dirname, 'images', 'image.jpg'),
            options: {}
        }

        ip.validateCache(  options.cacheFile, null, function( valid, modified ) {
            valid.should.equal( false );
            done();
        });
    });

    it('should generate resized image', function( done ) {
        var helper = ip.createHelper('');
        var link = helper('image.jpg', {
            width: 200,
            height: 200
        });

        var config = {
            source: path.join( __dirname, '/images' ),
            destination: '/tmp/express-imageprinter-test'
        };

        var middleware = ip.middleware( config );

        // Check that file does not exist
        var filepath =  path.join( config.destination, link );

        var exists = fs.existsSync( filepath );
        if( exists )
            fs.unlinkSync( filepath );

        var req = { path: link };
        var res = { send: function() {} };
        middleware( req, res, function( err ) {
            exists = fs.existsSync( filepath  );
            exists.should.be.equal( true );

            gm( filepath).size( function(err, result) {
                result.width.should.be.equal( 200 );
                result.height.should.be.equal( 200 );
                fs.unlinkSync( filepath );
                done();
            })
        });
    });


    it('should work with custom source/validator', function(done) {
        var helper = ip.createHelper('');
        var link = helper( 'image' );
        var config = {
            destination: '/tmp/express-imageprinter-test',
            source: function( name, next ) {
                next( null, path.join( __dirname,  'images', name + '.jpg' ) );
            },
            validate: function( name, next ) {
                next( true, null );
            }
        };

        var middleware = ip.middleware( config );

        var filepath =  path.join( config.destination, link );
        var req = { path: link };
        var res = { send: function( code, msg ) {
            code.should.equal( 200, msg );
        } };
        middleware( req, res, function( err ) {
            var exists = fs.existsSync( filepath  );
            exists.should.be.equal( true );
            done();
        });
    });

    it('should work with custom source without validator', function(done) {
        var helper = ip.createHelper('');
        var link = helper( 'image' );
        var config = {
            destination: '/tmp/express-imageprinter-test',
            source: function( name, next ) {
                next( null, path.join( __dirname,  'images', name + '.jpg' ) );
            }
        };

        var middleware = ip.middleware( config );

        var filepath =  path.join( config.destination, link );
        var req = { path: link };
        var res = { send: function( code, msg ) {
            code.should.equal( 200, msg );
        } };
        middleware( req, res, function( err ) {
            var exists = fs.existsSync( filepath  );
            exists.should.be.equal( true );
            done();
        });
    });
});
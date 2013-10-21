/**
 * Image printing module.
 */

var express = require( 'express' );
var _ = require( 'underscore' );
var mkdirp = require( 'mkdirp' );
var path = require( 'path' );
var fs = require( 'fs' );
var gm = require( 'gm' );
var qs = require( 'querystring' );


/**
 * Enable debug prints.
 *
 * @type {boolean}
 */
var debug = false;


/**
 * Enable/disable debug logging
 *
 * @param enable        Boolean
 */
module.exports.debug = function( enable ) {
    debug = enable;
};


/**
 * Separator used in file name encoding.
 *
 * @type {string}
 */
var optsSeparator = '__';


/**
 * Middle ware default configuration.
 *
 * @type {{destination: string, source: string, type: string}}
 */
var optionDefaults = {
    // Where to store converted images
    destination: '/tmp/express-imageprinter',
    // Source of images: root directory, mongo collection ....
    source: '',
    // Used later for specifying source of image ( file, mongodb, ... )
    type: 'file',
    // Static file serving cache-control
    maxAge: undefined
};


/**
 * Default options for image.
 *
 * @type {{width: number, height: number, crop: boolean , quality: number}}
 */
var imageOptionDefaults = {
    width: 300,
    height: 200,
    crop: true,
    quality: 80
};


/**
 * Creates helper function for creating URLs for image printer.
 *
 * @param prefix        URI prefix of middleware, use same prefix as configured to middleware
 * @param options       Image processing defaults
 * @returns {Function}  Helper function for generating links
 */
module.exports.createHelper = function( prefix, options ) {
    var _prefix = prefix || '';
    var _options = _.defaults( options || {}, imageOptionDefaults );

    return function ( filepath, options ) {
        var imgOpts = _.defaults( options || {}, _options );

        var dirPath = path.dirname( filepath );
        var fileExt = path.extname( filepath );
        var base = path.basename( filepath, fileExt );

        var resizeFileName = base + optsSeparator + serializeOptions(imgOpts) + fileExt;
        return path.join( _prefix, dirPath, resizeFileName );
    };
};


/**
 * Create middle ware component for express.
 *
 * <pre>
 * var ip = require('express-imageprintter'):
 * app.use( '/ip', ip.middleware( {
 *      source: './public/images',
 *      destination: '/tmp/image-cache',
 *      maxAge: 86400000 // one day
 * }));
 *
 * var scaleHelper = ip.createHelper( '/ip' );
 * app.get( '/', function( req, res ) {
 *      var link = scaleHelper( 'logo.jpg', { width: 200, height:120 } );
 *      res.render( 'index', { logo: link } );
 * });
 * </pre>
 *
 * @param options
 * @returns {Function}
 */
module.exports.middleware = function( options ) {
    // Get middle ware configuration options
    var _config = _.defaults( options || {} , optionDefaults );

    // Get express static middle ware, that will serve cached files
    var expressStatic = express.static( _config.destination, {
        // Set cache control if configured
        maxAge: _config.maxAge || 0
    });

    // Define middle ware function
    function ImagePrinter( req, res, next ) {
        // Parse request
        var request = parseRequest( req.path );
        request.source = path.join( _config.source, request.source );
        request.cacheFile = path.join( _config.destination, request.cacheFile );

        // Print data if debugging
        if( debug ) {
                console.log();
            console.log( 'request path:', req.path );
            console.log( ' config:', _config );
            console.log( ' request:', request );
        }

        // Check does file exist
        validateCache( request, function( err, cached ) {
            if( err ) {
                res.send( 404, 'Invalid request' );
                return;
            }

            // Cache exists, so serve file with static
            if( cached ) {
                expressStatic( req, res, next );
                return;
            }

            // Process image and store it to cache file
            processImage( request, function( err ) {
                if( err ) {
                    res.send( 500, 'Could not process image' );
                    return;
                }

                // Server file with express.static
                expressStatic( req, res, next );
            });
        });
    }

    // Return middle ware function
    return ImagePrinter;
};


/**
 * Set image processing operation.
 *
 * @param name      Name of image operation
 * @param func      Function to call { function( img, options ) }
 */
module.exports.set = function( name, func ) {
    // If name is not given, then set new default operation
    if( ! func  ) {
        func = name;
        name = 'default';
    }
    // Make sure that we actually have real Function
    if( ! func instanceof Function ) {
        throw new Error('second argument is not function');
    }

    // Set operation to list
    imageOperations[name] = func;
};

/**
 * Image processing operations
 *
 * @type {{default: Function}}
 */
var imageOperations = {
    default: resize
};




// ----------------------------------------------------------------------------
// Internal functions for image processing
// ----------------------------------------------------------------------------

/**
 * Do actual image processing. make sure cache directory structure is created,
 * call correct image processing operation and store result to cache file.
 *
 * @param request       Request data: cache file name, source file and image
 *                      processing options
 * @param next          Callback
 */
function processImage( request, next ) {
    // First make sure path is available
    mkdirp( path.dirname( request.cacheFile ), function(err) {
        if( err ) {
            console.error( 'Could not create path', path.dirname( request.cacheFile ) );
            next( err );
            return;
        }

        // Image process to be used
        var imageProcess = request.options.op || 'default';
        if( ! imageOperations.hasOwnProperty( imageProcess  ) ) {
            next( new Error('Operation not defined: ' + imageProcess ) );
            return
        }

        // Instantiate GraphicsMagic object
        var img = gm( request.source );

        // Do image processing with selected operation
        imageOperations[imageProcess]( img, request.options );

        // Write result to file
        img.write( request.cacheFile, function( err ) {
            if( err ) {
                console.error('gm', err );
            }
            next( err );
        });
    });
}


/**
 * Handle image resizing
 *
 * @param img
 * @param options
 * @returns {*}
 */
function resize( img, options ) {
    if( debug ) console.log( options );

    var crop = {
        width: options.width,
        height: options.height
    };

    if( options.width > options.height ) {
        options.width = '';
    }
    else {
        crop.width = options.height;
        crop.height = options.width;
        options.height = '';
    }

    img.resize( options.width, options.height );
    img.quality( options.quality );

    if( options.crop === 'true' ) {
        img.crop(crop.width, crop.height);
        img.gravity('Center');
        img.extent(crop.width, crop.height);
    }
}


/**
 * Serialize options
 *
 * @param opts      Options object
 * @returns {*}     String
 */
function serializeOptions( opts ) {
    return qs.stringify( opts, ',', '_');
}


/**
 * Deserialize options string
 *
 * @param optsString    Options string
 * @returns {*}         Object
 */
function deserializeOptions( optsString ) {
    return qs.parse( optsString, ',', '_' );
}


/**
 * Parse URI to image resize options.
 *
 * @param uripath   URI string
 * @returns {*}
 */
function parseRequest( uripath ) {
    // Get path before options
    var dirPath = path.dirname( uripath );
    // Get file extension
    var fileExt = path.extname( uripath );
    // Base file name
    var base = path.basename( uripath, fileExt );

    var optsPoint = base.lastIndexOf( optsSeparator );
    if( optsPoint === -1 ) {
        console.error( 'Invalid URI path, no optsSeparator found!' );
        return res.send( 404, 'Invalid path' );
    }
    // Get serialized options
    var resizeOptsString = base.slice( optsPoint + optsSeparator.length );

    // Get real base file name
    var filename = base.slice( 0, optsPoint );

    // Deserialize options from filename string
    var options = deserializeOptions( resizeOptsString );

    // Real file path
    var sourceFile = path.join( dirPath, filename + fileExt );

    return {
        cacheFile: uripath,
        source: sourceFile,
        options: options
    }
}


/**
 * Check is resized image in place.
 *
 * @param options       parseRequest object
 * @param next          callback( err, cached )
 */
function validateCache( options, next ) {
    if( debug ) {
        console.log();
        console.log( 'validateCache:', options.cacheFile );
    }

    // Check that source file exists
    fs.stat( options.source, function( err, sourceStat ) {
        // If err, then file does not exist
        if( err ) {
            if( debug ) console.log( 'validateCache:', 'source does not exists' );
            return next( err );
        }

        if( debug ) console.log( 'validateCache:', 'source exists' );

        fs.stat( options.cacheFile, function( err, cacheStat) {
            // If err then cache file doesn't exist
            if( err ) {
                if( debug ) console.log( 'validateCache:','cache does not exist' );
                return next( null, false );
            }

            if( debug ) console.log( 'validateCache:','cache exist' );

            // Cache file exist, check does it need update
            if( cacheStat.ctime < sourceStat.ctime ) {
                if( debug ) console.log( 'validateCache:','cache too old' );
                // Force re-cache
                return next( null, false );
            }

            // Check that file is not empty
            if( ! cacheStat.size ) {
                if( debug ) console.log( 'validateCache:','cache is empty' );
                return next( null, false );
            }

            // Cache exists and is newer than source file, so
            // it should be valid then.
            if( debug ) console.log( 'validateCache:','cache is valid' );

            return next( null, true );
        });
    });
}


// Export internal function only for unit testing
if( process.env.NODE_ENV === 'test' ) {
    module.exports.serializeOptions = serializeOptions;
    module.exports.deserializeOptions = deserializeOptions;
    module.exports.parseRequest = parseRequest;
    module.exports.validateCache = validateCache;
}

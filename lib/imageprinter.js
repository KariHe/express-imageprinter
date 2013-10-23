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
 * Separator configuration.
 *
 * @type {{opts: string, value: string, param: string}}
 */
var separator = {
    opts: '__',
    value: '-',
    param: ','
};


/**
 * Middle ware default configuration.
 *
 * @type {{destination: string, source: string|function}}
 */
var optionDefaults = {
    // Where to store converted images
    destination: '/tmp/express-imageprinter',

    // Source of images: root directory or callback methods to get buffer/stream
    source: '',

    // Function to validate source file. If using source path (file system) then default
    // file system validator is used.
    validate: undefined,

    // Static file serving cache-control
    maxAge: undefined,

    // Use image magick instead of Graphics Magick
    imageMagick: false
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

        var resizeFileName = base + separator.opts + serializeOptions(imgOpts) + fileExt;
        return path.join( _prefix, dirPath, resizeFileName).split(path.sep).join('/');
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

    // If source is string then use file validator(checker) and source is file path
    if( typeof _config.source === 'string' ) {
        // Store path string to variable
        var sourcePath = _config.source;

        /**
         * Get source file path.
         * @param source    file name
         * @param next      callback
         */
        _config.source = function sourceFunc( source, next ) {
            next( null, path.join( sourcePath, source ) );
        }

        /**
         * validate source file. exists
         * @param source    Source file name
         * @param next      callback
         */
        _config.validate = function validateFunc( source, next ) {
            fs.stat( path.join( sourcePath, source ), function( err, sourceStat ) {
                if( err ) {
                    next( false );
                }
                else {
                    next( true, sourceStat.ctime );
                }
            });
        }
    }
    else {
        if( debug ) console.log( 'Using custom methods' );
        // If validate is not defined use by pass function
        if( ! _config.validate ) {
            _config.validate = function bypass( source, next ) {
                next( true, null );
            }
        }
    }



    // Define middle ware function
    function ImagePrinter( req, res, next ) {
        // Parse request
        var request = parseRequest( req.path );
        request.cacheFile = path.join( _config.destination, request.cacheFile );

        // Print data if debugging
        if( debug ) {
            console.log();
            console.log( 'request path:', req.path );
            console.log( ' config:', _config );
            console.log( ' request:', request );
        }

        // Check that source is valid and exists
        _config.validate( request.source, function( valid, modified ) {
            if( valid !== true ) {
                res.send( 404, 'Invalid request' );
                return;
            }

            // Check is cache file in place or should we generate it.
            validateCache( request.cacheFile, modified, function( exists ) {
                if( debug ) console.log( 'ImagePrinter: cache', exists ? 'exist' : 'missing','for',  req.path )

                if( exists === true ) {
                    expressStatic( req, res, next );
                }
                else {
                    // Process image and create cache file
                    processImage( request, _config, function( err ) {
                        if( err ) {
                            res.send( 404, 'Invalid request' );
                        }
                        else {
                            expressStatic( req, res, next );
                        }
                    })
                }
            });
        })
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
 * @param config        Middle ware configuration
 * @param next          Callback
 */
function processImage( request, config, next ) {
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
            return;
        }

        // Get source image
        config.source( request.source, function( err, image ) {
            if( err ) {
                console.error( 'Could not get image' );
                next( err );
                return;
            }

            // Instantiate GraphicsMagic object
            var img;
            if( config.imageMagick ) {
                img = gm.subClass({ imageMagick: true })( image );
            }
            else {
                img = gm( image );
            }

            // Do image processing with selected operation
            var func = imageOperations[imageProcess];
            func( img, request.options, function( err, img ) {
                if( err ) {
                    next( err );
                    return;
                }

                // Write result to file
                img.write( request.cacheFile, function( err ) {
                    if( err ) { console.error('gm', err ); }
                    next( err );
                });
            });
        });
    });
}


/**
 * Handle image resizing. Default resize operation.
 *
 * @param img           gm image object
 * @param options       Image processing options
 * @param next          Callback { function( err, img ) }
 * @returns {*}
 */
function resize( img, options, next ) {
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
    next( null, img );
}


/**
 * Serialize options
 *
 * @param opts      Options object
 * @returns {*}     String
 */
function serializeOptions( opts ) {
    return qs.stringify( opts, separator.param, separator.value );
}


/**
 * Deserialize options string
 *
 * @param optsString    Options string
 * @returns {*}         Object
 */
function deserializeOptions( optsString ) {
    return qs.parse( optsString, separator.param, separator.value );
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

    var optsPoint = base.lastIndexOf( separator.opts );
    if( optsPoint === -1 ) {
        console.error( 'Invalid URI path, no opts separator found!' );
        return res.send( 404, 'Invalid path' );
    }
    // Get serialized options
    var resizeOptsString = base.slice( optsPoint + separator.opts.length );

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
 * @param cacheFile     Cache file path
 * @param modified      Source modification time
 * @param next          callback( err, cached )
 */
function validateCache( cacheFile, modified, next ) {
    fs.stat( cacheFile, function( err, cacheStat ) {
        // If err then cache file doesn't exist
        if( err ) {
            if( debug ) console.log( 'validateCache:','cache does not exist' );
            return next( false );
        }

        // Cache file exist, check does it need update
        if( modified && cacheStat.ctime < modified ) {
            // Force re-cache
            if( debug ) console.log( 'validateCache:','cache too old' );
            return next( false );
        }

        // Check that file is not empty
        if( ! cacheStat.size ) {
            if( debug ) console.log( 'validateCache:','cache is empty' );
            return next( false );
        }

        // Cache exists and is newer than source file, so
        // it should be valid then.
        return next( true );
    });

}

// Export internal function only for unit testing
if( process.env.NODE_ENV === 'test' ) {
    module.exports.serializeOptions = serializeOptions;
    module.exports.deserializeOptions = deserializeOptions;
    module.exports.parseRequest = parseRequest;
    module.exports.validateCache = validateCache;
}

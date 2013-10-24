/**
 * Created by kari on 10/23/13.
 */

function imageprinterCreateHelper ( prefix, options ) {
    var separator = {
        path: '/',
        opts: '__',
        value: '-',
        param: ','
    };

    var _options = {
        width: 300,
        height: 200,
        crop: true,
        quality: 80
    };

    var _prefix = prefix || '';
    for( var key in options ) {
        _options[key] = options[key];
    }

    return function helper( filepath, options ) {
        filepath = new String( filepath );

        // combine user options with configured default options
        var imgOpts = options || {};
        for( var key in _options ) {
            if( ! imgOpts.hasOwnProperty( key ) ) {
                imgOpts[key] = options[key];
            }
        }

        // Separate directory path from file path
        var idxPath = filepath.lastIndexOf( separator.path );
        var dirPath = idxPath !== -1 ? filepath.slice( 0, idxPath ) : '';

        // Separate file name from filepath
        var file = filepath.slice( idxPath + 1  );
        var idxFile = file.lastIndexOf( '.');

        // and file extension from file name
        var fileExt = idxFile !== -1 ? file.slice( idxFile ) : '';

        // Get file base name
        var base = fileExt.length ? file.slice( 0, idxFile ) : file;

        // Define new file name with image processing options
        var resizeFileName = base + separator.opts + serializeOptions(imgOpts) + fileExt;

        // Push all URI parts to list
        var parts = [];
        if( _prefix.length ) parts.push( _prefix );
        if( dirPath.length ) parts.push( dirPath );
        parts.push( resizeFileName );
        // .. and join them as URI
        return parts.join( separator.path );
    };


    function serializeOptions( options ) {
        var params = [];
        for( var key in options ) {
            var value  = typeof options[key] === 'object' ? '' : options[key];
            params.push( key + separator.value + value );
        }
        return params.join( separator.param );
    }
};
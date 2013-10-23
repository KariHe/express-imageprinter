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
        var imgOpts = options || {};
        for( var key in _options ) {
            if( ! imgOpts.hasOwnProperty( key ) ) {
                imgOpts[key] = options[key];
            }
        }

        var idxPath = filepath.lastIndexOf( separator.path );
        var dirPath = idxPath !== -1 ? filepath.slice( 0, idxPath ) : '';

        var file = filepath.slice( dirPath.length + 1 );
        var idxFile = file.lastIndexOf( '.');
        var fileExt = idxFile !== -1 ? file.slice( idxFile ) : '';

        var base = fileExt.length ? file.slice( 0, idxFile ) : file;

        var resizeFileName = base + separator.opts + serializeOptions(imgOpts) + fileExt;
        var parts = [];
        if( _prefix.length ) parts.push( _prefix );
        if( dirPath.length ) parts.push( dirPath );
        parts.push( resizeFileName );
        return parts.join( separator.path );
    };


    function serializeOptions( options ) {
        var params = [];
        for( var key in options ) {
            var value  = typeof options[key] === 'object' ? '' : options[key];
            params.push( key + separator.value + value );
        }
        console.log( params );
        return params.join( separator.param );
    }
};

if( module ) {
    module.exports = imageprinterCreateHelper;
}
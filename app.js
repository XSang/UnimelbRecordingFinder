// Include dependencies
var fs = require('fs');
var http = require('http');
var parseString = require('xml2js').parseString;

// Jquery stuff
var cheerio = require('cheerio');

// Load any old recordings
var recordings = {};
if(fs.existsSync('./recordings.json')) {
    recordings = require('./recordings.json');
}

// Recording location
var preLink = 'http://download.lecture.unimelb.edu.au/echo360/sections/';
var postLink = '/section.xml';

// Tell the user what is going on
console.log('Grabbing lastest links...');

// Request the page containing links
var content = '';
http.get(preLink, function(res) {
    // Grab the data:
    res.on('data', function (chunk) {
        content += chunk;
    }).on('end', function() {
        // Update the user on progress
        console.log('Finished grabbing links, processing...');

        // Prepare cheerio
        $ = cheerio.load(content);

        // Build list of things to process
        var toProcess = [];
        $('table a').each(function() {
            // Grab the link:
            var link = $(this).html();

            // Check if it is a valid lecture recording page:
            if(link.length > 30) {
                // Make sure we don't already have this recording
                if(!recordings[link]) {
                    // Store that we need to process this link
                    toProcess.push(link.substring(0, link.length-1));
                }
            }
        });

        var upto = 0;

        function processLink() {
            // Grab the next link
            var link = toProcess[upto];

            // Update the user's process
            console.log('Processing '+(upto+1)+'/'+toProcess.length+' ('+link+')');

            var xmlContent = '';

            // Request the page:
            http.get(preLink+link+postLink, function(res) {
                // Grab the data:
                res.on('data', function (chunk) {
                    xmlContent += chunk;
                }).on('end', function() {
                    // Pipe into xml parser:
                    parseString(xmlContent, function (err, result) {
                        if(err) {
                            // Failed to parse
                            console.log('Failed to parse XML Link '+link);
                        } else {
                            // Grab data
                            var name = result.section.course[0].name[0];
                            var id = result.section.course[0].identifier[0];
                            var url = result.section.portal[0].url[0];
                            var term = result.section.term[0].name[0];

                            // Store it:
                            recordings[link] = {
                                id: id,
                                name: name,
                                url: url,
                                term: term
                            }

                            // Check if there is anything else to process
                            if(++upto < toProcess.length) {
                                // Process the next link
                                processLink();
                            } else {
                                // All done
                                console.log('Recordings updated, saving...');

                                // Prepare the data
                                var data = JSON.stringify(recordings);

                                // Store file
                                fs.writeFile('./recordings.json', data, "utf8", function(err) {
                                    if (err) {
                                        // Failed to write, lets log the JSON (so they dont lose it)
                                        console.log(data);

                                        throw err;
                                    }

                                    // Success!
                                    console.log('Finished saving recordings!');
                                });
                            }
                        }
                    })
                });
            }).on('error', function(err) {
                console.log(link+' got error: ' + err.message);
            });
        }

        if(toProcess.length > 0) {
            // Something to process, process it
            processLink();
        } else {
            // Nothing new, just exist
            console.log('Failed to find any new recording links.');
        }
    });
}).on('error', function(err) {
    throw err;
});

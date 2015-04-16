// ==UserScript==
// @name Download Friend Info FB
// @namespace com.bashfuleagle.facebook
// @description JavaScript program that will download all visible contact information from your friends
// @include https://www.facebook.com/search/me/friends
// @version 0.0.3
// @grant none
// @downloadURL https://raw.githubusercontent.com/BashfulEagle/download-friend-info-fb/master/download-friend-info-fb.user.js
// @updateURL https://raw.githubusercontent.com/BashfulEagle/download-friend-info-fb/master/download-friend-info-fb.user.js
// @require https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js
// ==/UserScript==

/*
@TODO:
* Load all friends via ajax (don't force user to scroll until all friends loaded manually)
* figure out a way to output the info
* * for now, probably just an alert or other raw csv text output that the user must copy-paste into a new file
 */
(function ($) {

    var contact_info_array = []; // global variable that holds the processed contact information
    var running_ajax = 0; // each ajax call will increment this by one, and decrement when complete (either success or failure)

    var ACCESSIBLE_PHONES = "Phones";
    var ACCESSIBLE_EMAILS = "Email";
    var ACCESSIBLE_ADDRESS = "Address";
    var ACCESSIBLE_INSTANT_MESSENGERS = "Other Account";
    var ACCESSIBLE_WEBSITES = "Website";
    var ACCESSIBLE_BIRTHDAY = "Birthday";


    function init(){

        // run this on a 'profile/friends' page. usually on your own, but could be run on
        // any user's profiles to get their friends' info (some people post public info
        // that you can see even if you aren't directly their friend)
        // @TODO somehow load all of the ajax friends before running


        $('a._8o._8s.lfloat._ohe').each(function(){
            var profile_url =  $(this).attr('href') + "&sk=about";
            load_friend_profile(profile_url);
        });

    }
    function load_friend_profile(profile_url){
        $.ajax({
            type: "GET",
            url: profile_url,
            beforeSend: function(){
                running_ajax++;
            },
            success: function(data){
                process_friend_profile(data);
            },
            complete: function(){
                running_ajax--;
                if (running_ajax == 0){
                    all_ajax_complete();
                }
            }
        })
    }

    /**
     * Continues script execution after all ajax calls are done.
     *
     */
    function all_ajax_complete(){
        contact_info_array.sort(function(a, b){
            var nameA=a.name.toLowerCase(), nameB=b.name.toLowerCase();
            if (nameA < nameB) //sort string ascending
                return -1;
            if (nameA > nameB)
                return 1;
            return 0; //default return value (no sorting)
        });
        console.log(contact_info_array);
    }

    /**
     * Takes the ajax raw data and extracts the contact information
     * @param raw_data
     */
    function process_friend_profile(raw_data){
        var profile_html = preprocess_raw_profile_data(raw_data);
        contact_info_array.push(extract_contact_info(profile_html));

    }

    /**
     * Takes the raw data and pre-processes it. Mainly, it removes
     * the first HTML comment (an actual comment), then uncomments
     * all of the other HTML comments (which contains actual HTML elements),
     * so that jQuery can search across those hidden elements
     * @param raw_data
     */
    function preprocess_raw_profile_data(raw_data){
        raw_data = raw_data.replace(/<!-- BigPipe construction and first response -->/g,'');
        raw_data = raw_data.replace(/<!--/g ,'');
        raw_data = raw_data.replace(/-->/g,'');
        return raw_data;
    }

    function extract_contact_info(html){
        var friend_contact_info = [];
        friend_contact_info.name = extract_contact_info_name(html);
        friend_contact_info.alternate_name = extract_contact_info_alternate_name(html);
        friend_contact_info.phones = extract_contact_info_phones(html);
        friend_contact_info.emails = extract_contact_info_generic(html, ACCESSIBLE_EMAILS);
        friend_contact_info.address = extract_contact_info_address(html);
        friend_contact_info.instant_messengers = extract_contact_info_instant_messengers(html);
        friend_contact_info.websites = extract_contact_info_generic(html, ACCESSIBLE_WEBSITES);
        friend_contact_info.birthday = extract_contact_info_birthday(html);
        friend_contact_info.anniversary = extract_contact_info_anniversary(html);
        //console.log(friend_contact_info);
        return friend_contact_info;
    }

    /**
     * Returns an array with phone number, emails, instant messengers, websites, etc (if defined),
     * Returns an empty array if not defined.
     * @param html
     * @param accessible_type CONSTANT definition of info type you wish to extract
     * @returns {Array}
     */
    function extract_contact_info_generic(html, accessible_type){
        if (contact_info_part_exists(html, accessible_type)){
            var info = [];

            var raw_info = $(html).find('span.accessible_elem:contains("' + accessible_type + '")').parent().siblings();

            $(raw_info).each(function(){
                info.push($(this).text());
            });

            return info;
        } else {
            return [];
        }
    }

    function extract_contact_info_name(html){
        return $(html).find('#fb-timeline-cover-name').justtext();
    }

    function extract_contact_info_alternate_name(html){
        return $(html).find('#fb-timeline-cover-name span.alternate_name').justtext().replace(/[()]/g,'');
    }

    /**
     * Extracts the phone number(s) (if exists). Returns in an array with numeric-only strings.
     * Phone numbers are assumed to be US.
     * @TODO check phone string for country code before extracting
     * @param html
     * @returns {Array}
     */
    function extract_contact_info_phones(html){
        var phone_array = extract_contact_info_generic(html, ACCESSIBLE_PHONES);
        for (var i=0; i<phone_array.length; i++){
            phone_array[i] = phone_array[i].replace(/[^0-9]/g,''); // remove non-numeric. facebook auto formats, disallows letters (replaces with numeric keypad equivalent), and requires area code
        }
        return phone_array;
    }

    /**
     * Extracts the address (if exists). Returns a string.
     * If no address is defined, returns an empty string.
     * @param html
     * @returns {String}
     */
    function extract_contact_info_address(html){
        if (contact_info_part_exists(html, ACCESSIBLE_ADDRESS)){
            var raw_info = $(html).find('span.accessible_elem:contains("' + ACCESSIBLE_ADDRESS + '")').parent().siblings();

            // addresses have multi-line addresses broken up by <li> elements
            var full_text = '';
            $(raw_info).find('span ul li').each(function(){
                full_text = full_text + $(this).text() + "\n";
            });
            return full_text;
        } else {
            return '';
        }
    }

    /**
     * Extracts the instant messenger entries and returns a key->value map with the messenger type as key (aim, yahoo, etc)
     * @param html
     * @returns {Array}
     */
    function extract_contact_info_instant_messengers(html){
        var messenger_array = extract_contact_info_generic(html, ACCESSIBLE_INSTANT_MESSENGERS);
        if (messenger_array.length > 0){
            var messenger_map = [];
            var messenger_key = '';
            var messenger_value = '';
            for (var i=0; i< messenger_array.length; i++){
                messenger_key = messenger_array[i].split('(')[1].replace(')','');
                messenger_value = messenger_array[i].split('(')[0];
                messenger_map.service = messenger_key;
                messenger_map.account = messenger_value;
            }
            return messenger_map;
        } else {
            return [];
        }
    }


    /**
     * Extracts the birthday (if exists). Returns it in a date object.
     * If month and day are defined, but not year, it will arbitrarily set the year to 1800.
     * If no birthday is defined, it will return null.
     * @param html
     * @returns {Date|null}
     */
    function extract_contact_info_birthday(html){
        if (contact_info_part_exists(html, ACCESSIBLE_BIRTHDAY)) {
            var raw_birthday_text = $(html).find('span.accessible_elem:contains("' + ACCESSIBLE_BIRTHDAY + '")').parent().siblings().text();
            if (raw_birthday_text.indexOf(',') === -1){
                // birth year is not defined. set as 1800 (since contacts cards cannot contain a date without a year)
                raw_birthday_text = raw_birthday_text + ', 1800';
            }
            var birthday = new Date(raw_birthday_text);
            return birthday;
            //var birthday_text = birthday.getFullYear() + '-' + ('0' + birthday.getMonth()).slice(-2) + ('0' + birthday.getDate()).slice(-2); // returns 0-padded YYYY-MM-DD
            //return birthday_text;
        } else {
            // no birthday defined. return null
            return null;
        }
    }

    /**
     * Extracts the anniversary (if exists). Returns it in a date object.
     * @param html
     * @returns {*}
     */
    function extract_contact_info_anniversary(html){
        var anniversary_html = $(html).find('div:contains("Married since ")');
        if (anniversary_html.length > 0){
            var anniversary_raw_text = anniversary_html.last().text();
            return new Date(anniversary_raw_text.replace('Married since ', ''));
        } else {
            // no anniversary defined. return null
            return null;
        }
    }

    /**
     * Runs a simple check to make sure the accessible element exists. If not, this contact info isn't defined.
     * @param html
     * @param accessible_element
     * @returns {boolean}
     */
    function contact_info_part_exists(html, accessible_element){
        var contact_info_element = $(html).find('span.accessible_elem:contains("' + accessible_element + '")');
        if (contact_info_element.length > 0){
            return true;
        } else {
            return false;
        }

    }

    /**
     * Returns the top-level text of the element, without the text of any sub-elements
     * @returns {XMLList|*}
     */
    jQuery.fn.justtext = function() {
        return $(this)	.clone()
            .children()
            .remove()
            .end()
            .text();

    };

    /**
     * Converts the specified URL into a base64 png text string
     * @param url
     * @param callback
     * @param outputFormat
     */
    function convertImgToBase64URL(url, callback, outputFormat){
        var canvas = document.createElement('CANVAS'),
            ctx = canvas.getContext('2d'),
            img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = function(){
            var dataURL;
            canvas.height = img.height;
            canvas.width = img.width;
            ctx.drawImage(img, 0, 0);
            dataURL = canvas.toDataURL(outputFormat);
            callback(dataURL);
            canvas = null;
        };
        img.src = url;
    }

    convertImgToBase64URL('https://fbcdn-profile-a.akamaihd.net/hprofile-ak-xap1/v/t1.0-1/p160x160/10649569_10100551160691870_1701327662643414705_n.jpg?oh=1936edc2f92f6d0f5296420267a10747&oe=55B2C325&__gda__=1436239856_3b9a08f0fa65410c4302cfb02ca4a643', function(base64Img){
        // Base64DataURL
        console.log(base64Img);
    }, 'image/jpeg');

    init(); // run the script
}(jQuery));

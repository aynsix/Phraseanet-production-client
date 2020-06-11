import $ from 'jquery';
import dialog from 'phraseanet-common/src/components/dialog';

const videoSubtitleCapture = (services, datas, activeTab = false) => {
    const {configService, localeService, appEvents} = services;
    const url = configService.get('baseUrl');
    const initialize = (params) => {
        let {$container, data} = params;

        $container.on('click', '.add-subtitle-vtt', function (e) {
            e.preventDefault();
            addSubTitleVtt();
            setDiffTime();

        });
        let startVal = 0;
        let endVal = 0;
        let diffVal = 0;

        function setDiffTime(e) {
            $('.startTime').on('keyup change', function (e) {
                startVal = stringToseconde($(this).val());
                $(this).closest('.video-subtitle-item').find('.endTime').on('keyup change', function (e) {
                    endVal = stringToseconde($(this).val());
                    diffVal = millisecondeToTime(endVal - startVal);
                    $(this).closest('.video-subtitle-item').find('.showForTime').val(diffVal);
                })
            });
            return;
        }

        function stringToseconde(time) {
            let tt = time.split(":");
            let sec = tt[0] * 3600 + tt[1] * 60 + tt[2] * 1;
            return sec * 1000;
        }

        function millisecondeToTime(duration) {
            var milliseconds = parseInt((duration % 1000 / 100) * 100),
                seconds = parseInt((duration / 1000) % 60),
                minutes = parseInt((duration / (1000 * 60)) % 60),
                hours = parseInt((duration / (1000 * 60 * 60)) % 24);

            hours = (hours < 10) ? "0" + hours : hours;
            minutes = (minutes < 10) ? "0" + minutes : minutes;
            seconds = (seconds < 10) ? "0" + seconds : seconds;
            // if(isNaN(hours) && isNaN(minutes) && isNaN(seconds) && isNaN(milliseconds) ) {
            return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
            //}

        }

        $container.on('click', '.remove-item', function (e) {
            e.preventDefault();
            $(this).closest('.video-subtitle-item').remove();
        });

        $('.submit-subtitle').on('click', function (e) {
            e.preventDefault();
            try {
                var allData = $('#video-subtitle-list').serializeArray();
                allData = JSON.parse(JSON.stringify(allData));

                var countSubtitle = $('.video-subtitle-item').length;
                if (allData) {
                    var i = 0;
                    var captionText = "WEBVTT\n\n";
                    while (i <= countSubtitle * 3) {
                        captionText += allData[i].value + " --> " + allData[i + 1].value + "\n" + allData[i + 2].value + "\n\n";
                        i = i + 3;
                        if(i == (countSubtitle * 3) - 3 ) {
                            $('#record-vtt').val(captionText);
                            console.log(captionText);

                            // put everyting on the form to send
                            var captionData = $('#video-subtitle-data').serializeArray();
                            captionData = JSON.parse(JSON.stringify(captionData));
                            console.log(captionData);
                        }


                    };
                }

            } catch (err) {
                return;
            }
        });


        const addSubTitleVtt = () => {
            let countSubtitle = $('.video-subtitle-item').length;
            let item = $('#default-item').html();
            $('.fields-wrapper').append(item);
            $('.video-subtitle-item:last .time').attr('pattern', '[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9]{3}$');
            $('.video-subtitle-item:last .startTime').attr('name', 'startTime' + countSubtitle).addClass('startTime' + countSubtitle);
            $('.video-subtitle-item:last .endTime').attr('name', 'endTime' + countSubtitle).addClass('endTime' + countSubtitle);
            $('.video-subtitle-item:last .number').html(countSubtitle);
            setDiffTime();
        };
    }


    return {
        initialize
    }
}


export default videoSubtitleCapture;

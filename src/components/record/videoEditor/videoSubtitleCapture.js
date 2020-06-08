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
        });
        $container.on('click', '.remove-item', function (e) {
            e.preventDefault();
            $(this).closest('.video-subtitle-item').remove();
        });
test
    }


    const addSubTitleVtt = () => {
        let item = " <fieldset class='video-subtitle-item'><div class='item-field start-time' ><label>Start time</label><input type='text' name='startTime'/></div><div class='item-field show-for-time'><label>Show for</label><input type='text' name='showForTime'/></div> <div class='item-field end-time'><label>End time</label><input type='text' name='endTime'/></div> <div class='item-field caption-text'><textarea name='captionText'></textarea></div> <div class='remove-item'><i class='fa fa-times-circle'></i> </div></fieldset>";
        $('.fields-wrapper').append(item);
    }




    return {
        initialize
    }
}

export default videoSubtitleCapture;

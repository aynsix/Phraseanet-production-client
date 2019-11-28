import $ from 'jquery';
import ConfigService from './../components/core/configService';
import LocaleService from '../components/locale';
import defaultConfig from './config';
import Emitter from '../components/core/emitter';
// import lightbox from './../components/lightbox/index';
// import mainMenu from './../components/mainMenu';
import merge from 'lodash.merge';
require('phraseanet-common/src/components/tooltip');
require('phraseanet-common/src/components/vendors/contextMenu');

class Bootstrap {
    app;
    configService;
    localeService;
    appServices;
    appLightbox;
    validatorLoaded;
    isReleasable;

    constructor(userConfig) {
        const configuration = merge({}, defaultConfig, userConfig);

        this.appEvents = new Emitter();
        this.configService = new ConfigService(configuration);
        this.validatorLoaded = false;
        this.localeService = new LocaleService({
            configService: this.configService
        });

        this.localeService.fetchTranslations()
            .then(() => {
                this.onConfigReady();
            });

        return this;
    }

    onConfigReady() {
        this.appServices = {
            configService: this.configService,
            localeService: this.localeService,
            appEvents: this.appEvents
        };

        window.bodySize = {
            x: 0,
            y: 0
        };

        /**
         * add components
         */

        $(document).ready(() => {
            // let $body = $('body');
            // window.bodySize.y = $body.height();
            // window.bodySize.x = $body.width();
            //
            // this.appLightbox = lightbox(this.appServices);
            // this.appLightbox.initialize({$container: $body});
            //mainMenu(this.appServices).initialize({$container: $body});
            this.mobileValidator();
            // this.isReleasable = this.configService.get('releasable');
            //
            // if (this.isReleasable !== null) {
            //     this.appLightbox.setReleasable(this.isReleasable);
            // }
        });

    }

    mobileValidator() {

        display_basket();

        $('body').on('touchstart click', '.confirm_report', (event) => {
            event.preventDefault();
            const $el = $(event.currentTarget);

            $('.loader', $el).css({
                visibility: 'visible'
            });

            $.ajax({
                type: 'POST',
                url: '/lightbox/ajax/SET_RELEASE/' + $('#basket_validation_id').val() + '/',
                dataType: 'json',
                error: (data) => {
                    $('.loader', $el).css({
                        visibility: 'hidden'
                    });
                },
                timeout: (data) => {
                    $('.loader', $el).css({
                        visibility: 'hidden'
                    });
                },
                success: (data) => {
                    $('.loader', $el).css({
                        visibility: 'hidden'
                    });
                    if (data.datas) {
                  //      alert(data.datas);
                        window.location.href = "/lightbox";
                    }
                    if (!data.error) {
                        this.isReleasable = false;
                        //this.appLightbox.setReleasable(this.isReleasable);
                    }

                    return;
                }
            });
            return false;
        });

        $('body').on('touchstart click', '.agreement_radio', (event) => {
            //$('.agreement_radio').on('mousedown', (event) => {
            const $el = $(event.currentTarget);
            var sselcont_id = $el.attr('for').split('_').pop();
            var agreement = $('#' + $el.attr('for')).val() === 'yes' ? '1' : '-1';

            $.mobile.loading();

            $.ajax({
                type: 'POST',
                url: '/lightbox/ajax/SET_ELEMENT_AGREEMENT/' + sselcont_id + '/',
                dataType: 'json',
                data: {
                    agreement: agreement
                },
                error: function (datas) {
                    alert('error');
                    $.mobile.loading();
                },
                timeout: function (datas) {
                    alert('error');
                    $.mobile.loading();
                },
                success: (datas) => {
                    if (!datas.error) {
                        if (agreement === 1) {
                            $('.valid_choice_' + sselcont_id).removeClass('disagree').addClass('agree');
                        } else {
                            $('.valid_choice_' + sselcont_id).removeClass('agree').addClass('disagree');
                        }
                        $.mobile.loading();
                        if (datas.error) {
                            alert(datas.datas);
                            return;
                        }
                        this.isReleasable = datas.release;
                        //this.appLightbox.setReleasable(this.isReleasable);
                    } else {
                        alert(datas.datas);
                    }
                    return;
                }
            });
            //return false;

        });

        $('body').on('touchstart click', '.note_area_validate', (event) => {

            const $el = $(event.currentTarget);
            var sselcont_id = $el.closest('form').find('input[name="sselcont_id"]').val();

            $.mobile.loading();
            $.ajax({
                type: 'POST',
                url: '/lightbox/ajax/SET_NOTE/' + sselcont_id + '/',
                dataType: 'json',
                data: {
                    note: $('#note_form_' + sselcont_id).find('textarea').val()
                },
                error: function (datas) {
                    alert('error');
                    $.mobile.loading();
                },
                timeout: function (datas) {
                    alert('error');
                    $.mobile.loading();
                },
                success: function (datas) {
                    $.mobile.loading();
                    if (datas.error) {
                        alert(datas.datas);
                        return;
                    }

                    $('#notes_' + sselcont_id).empty().append(datas.datas);
                    window.location.reload();
                    return;
                }
            });
            return false;
        });


        function display_basket() {
            let sc_wrapper = $('#sc_wrapper');


            $('.basket_element', sc_wrapper).parent()
                .bind('click', function (event) {
                    scid_click(event, this);
                    adjust_visibility(this);
                    return false;
                });

            $('.agree_button, .disagree_button', sc_wrapper).bind('click',function (event) {

                var sselcont_id = $(this).closest('.basket_element').attr('id').split('_').pop();

                var agreement = $(this).hasClass('agree_button') ? '1' : '-1';

                set_agreement(event, $(this), sselcont_id, agreement);
                return false;
            }).addClass('clickable');

            var n = $('.basket_element', sc_wrapper).length;
            $('#sc_container').width(n * $('.basket_element_wrapper:first', sc_wrapper).outerWidth() + 1);

        }

        this.validatorLoaded = true;
    }
}

const bootstrap = (userConfig) => {
    return new Bootstrap(userConfig);
};

export default bootstrap;

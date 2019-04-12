require('./facets.scss');

import $ from 'jquery';
require('jquery-ui');
require('jquery.fancytree/src/jquery.fancytree');
import * as _ from 'underscore';
const workzoneFacets = services => {
    const { configService, localeService, appEvents } = services;

    let facets = null;

    const ORDER_BY_BCT = "ORDER_BY_BCT";
    const ORDER_ALPHA_ASC = "ORDER_ALPHA_ASC";
    const ORDER_BY_HITS = "ORDER_BY_HITS";

    let selectedFacets = {};
    let facetStatus = $.parseJSON(sessionStorage.getItem('facetStatus')) || [];
    let hiddenFacetsList = [];



    var resetSelectedFacets = function () {
        selectedFacets = {};
        return selectedFacets;
    };
    // if defined, play the first query
    //
    try {
        var jsq = $("#FIRST_QUERY_CONTAINER");
        if(jsq.length > 0) {
            // there is a query to play
            if(jsq.data('format') === "json") {
                // json
                jsq = JSON.parse(jsq.text());
                 facets = jsq._facets;
            }

        }
    }
    catch (e) {
        // malformed jsonquery ?
        // no-op
    }
    /**
     *  add missing selected facets fields into "facets", from "selectedFacets"
     *  why : because if we negates all values for a facet field (all red), the facet will disapear from next query->answers
     *        (not in "facets" anymore, not in ux). So we lose the posibility to delete or invert a facet value.
     *  nb : negating all facets values does not mean there will be 0 results, because the field can be empty for some records.
     */
    function facetsAddMissingSelected(_selectedFacets, _facets) {
        _.each(_selectedFacets, function (v, k) {
            var found = _.find(_facets, function (facet) {
                return (facet.field == k);
            });
            if(!found) {
                var i = _facets.push(_.clone(v)); // add a "fake" facet to facets
                _facets[i-1].values = [];      // with no values
            }
        });
    };

    var loadFacets = function (data) {
        hiddenFacetsList = data.hiddenFacetsList;

        function sortIteration(i) {
            switch(data.facetValueOrder) {
                case ORDER_ALPHA_ASC:
                    return i.value.toString().toLowerCase();
                    break;
                case ORDER_BY_HITS:
                    return i.count*-1;
                    break;
            }
        }
        facetsAddMissingSelected(selectedFacets, facets);

        // Convert facets data to fancytree source format
        var treeSource = _.map(data.facets, function (facet) {
            // Values
            var values = _.map(_.sortBy(facet.values, sortIteration), function (value) {
                return {
                    title: value.value + ' (' + value.count + ')',
                    query: value.query,
                    label: value.value,
                    tooltip: value.value + ' (' + value.count + ')'
                };
            });
            // Facet
            return {
                name: facet.name,
                title: facet.label,
                folder: true,
                children: values,
                expanded: !_.some(facetStatus, function(o) { return _.has(o, facet.name)})
            };
        });

        treeSource.sort(
            _sortFacets('title', true, function (a) {
                return a.toUpperCase();
            })
        );

        if(data.facetOrder == ORDER_BY_BCT) {
            treeSource = _sortByPredefinedFacets(treeSource, 'name', ['base_aggregate', 'collection_aggregate', 'doctype_aggregate']);
        }

        if(data.filterFacet == true) {
            treeSource = _shouldFilterSingleContent(treeSource);
        }

        if (hiddenFacetsList.length > 0) {
            treeSource = _shouldMaskNodes(treeSource, hiddenFacetsList);
        }

        treeSource = _parseColors(treeSource);

        return _getFacetsTree().reload(treeSource)
            .done(function () {
                _.each($('#proposals').find('.fancytree-expanded'), function (element, i) {
                    $(element).find('.fancytree-title, .fancytree-expander').css('line-height', $(element)[0].offsetHeight + 'px');
                    $(element).find('.mask-facets-btn, .fancytree-expander').css('height', $(element)[0].offsetHeight + 'px');

                    var li_s = $(element).next().children('li');
                    var ul = $(element).next();
                    if(li_s.length > 5) {
                        _.each(li_s, function(el, i) {
                            if(i > 4) {
                                $(el).hide();
                            }
                        });
                        ul.append('<button class="see_more_btn">See more</button>');
                    }
                });
                $('.see_more_btn').on('click', function() {
                    $(this).closest('ul').children().show();
                    $(this).hide();
                    return false;
                });
            });
    };

    function _parseColors(source) {
        _.forEach(source, function (facet) {
            if (!_.isUndefined(facet.children) && (facet.children.length > 0)) {
                _.forEach(facet.children, function (child) {
                    var title = child.title;
                    child.title = _formatColorText(title.toString());
                });
            }
        });
        return source;
    }

    function _formatColorText(string, textLimit = 0) {
        //get color code from text if exist
        var regexp = /^(.*)\[#([0-9a-fA-F]{6})].*$/;


        var match = string.match(regexp);
        if (match && match[2] != null) {
            var colorCode = '#' + match[2];
            // //add color circle and re move color code from text;
            var textWithoutColorCode = string.replace('[' + colorCode + ']', '');
            if (textLimit > 0 && textWithoutColorCode.length > textLimit) {
                textWithoutColorCode = textWithoutColorCode.substring(0, textLimit) + '…';
            }
            return '<span class="color-dot" style="background-color: ' + colorCode + '"></span>' + ' ' + textWithoutColorCode;
        } else {
            if (textLimit > 0 && string.length > textLimit) {
                string = string.substring(0, textLimit) + '…';
            }
            return string;
        }
    }


    // from stackoverflow
    // http://stackoverflow.com/questions/979256/sorting-an-array-of-javascript-objects/979325#979325
    function _sortFacets(field, reverse, primer) {
        var key = function (x) {
            return primer ? primer(x[field]) : x[field];
        };

        return function (a, b) {
            let A = key(a);
            let B = key(b);
            return (A < B ? -1 : A > B ? 1 : 0) * [-1, 1][+!!reverse];
        };
    }

    function _shouldMaskNodes(source, facetsList) {
        let filteredSource = source.slice();
        _.each(facetsList, function (facetsValue, index) {
            for (let i = filteredSource.length - 1; i > -1; --i) {
                let facet = filteredSource[i];
                if (facet['name'] !== undefined) {
                    if (facet['name'] === facetsValue.name) {
                        filteredSource.splice(i, 1);
                    }
                }
            }
        });
        return filteredSource;
    }

    function _shouldFilterSingleContent(source) {
        var filteredSource = [];
        _.forEach(source, function (facet) {
            if (
                !_.isUndefined(facet.children) &&
                (facet.children.length > 1 ||
                !_.isUndefined(selectedFacets[facet.title]))
            ) {
                filteredSource.push(facet);
            }
        });
        return filteredSource;
    }

    function _sortByPredefinedFacets(source, field, predefinedFieldOrder) {
        let filteredSource = source.slice();
        let ordered = [];

        _.each(predefinedFieldOrder, function (fieldValue, index) {
            for (let i = filteredSource.length - 1; i > -1; --i) {
                let facet = filteredSource[i];
                if (facet[field] !== undefined) {
                    if (facet[field] === fieldValue) {
                        ordered.push(facet);
                        // remove from filtered
                        filteredSource.splice(i, 1);
                    }
                }
            }
        });

        const olen = filteredSource.length;
        // fill predefined facets with non predefined facets
        for (let i = 0; i < olen; i++) {
            ordered.push(filteredSource[i]);
        }
        return ordered;
    }

    function _getFacetsTree() {
        var $facetsTree = $('#proposals');
        if (!$facetsTree.data('ui-fancytree')) {
            $facetsTree.fancytree({
                // activate and expand
                clickFolderMode: 3,
                icons: false,
                source: [],
                activate: function (event, data) {
                    var query = data.node.data.query;
                    var eventType = event.originalEvent;
                    //if user did not click, then no need to perform any query
                    if(eventType === null) {
                        return;
                    }
                    if (query) {
                        var facet = data.node.parent;
                        var facetData = {
                            value: data.node.data,
                            mode: event.altKey ? "EXCEPT" : "AND"
                        };

                        if (selectedFacets[facet.title] === null) {
                            selectedFacets[facet.title] = [];
                        }
                        selectedFacets[facet.title].push(facetData);

                        appEvents.emit('search.getSelectedFacets', selectedFacets);
                        _facetCombinedSearch();
                    }
                },
                collapse: function (event, data) {
                    var dict = {};
                    dict[data.node.data.name] = "collapse";
                    if (_.findWhere(facetStatus, dict) !== undefined ) {
                        facetStatus = _.without(facetStatus, _.findWhere(facetStatus, dict))
                    }
                    facetStatus.push(dict);
                    sessionStorage.setItem('facetStatus', JSON.stringify(facetStatus));
                },
                expand: function (event, data) {
                    var dict = {};
                    dict[data.node.data.name] = "collapse";
                    if (_.findWhere(facetStatus, dict) !== undefined) {
                        facetStatus = _.without(facetStatus, _.findWhere(facetStatus, dict))
                    }
                    sessionStorage.setItem('facetStatus', JSON.stringify(facetStatus));
                },
                renderNode: function (event, data) {
                    var facetFilter = "";
                    var node = data.node;
                    var $nodeSpan = $(node.span);

                    // check if span of node already rendered
                    if (!$nodeSpan.data('rendered')) {
                        var deleteButton = $('<div class="mask-facets-btn"><a></a></div>');
                        $nodeSpan.append(deleteButton);
                        deleteButton.hide();

                        $nodeSpan.hover(function () {
                            deleteButton.show();
                        }, function () {
                            deleteButton.hide();
                        });

                        deleteButton.click(function () {
                            var nodeObj = {name: node.data.name, title: node.title};
                            hiddenFacetsList.push(nodeObj);
                            node.remove();
                            appEvents.emit('search.saveHiddenFacetsList', hiddenFacetsList);
                            appEvents.emit('search.reloadHiddenFacetList', hiddenFacetsList);
                        });

                        // span rendered
                        $nodeSpan.data('rendered', true);

                        if (data.node.folder && !_.isUndefined(selectedFacets[data.node.title])) {
                            if ($(".fancytree-folder", data.node.li).find('.dataNode').length == 0) {
                                var dataNode = document.createElement('div');
                                dataNode.setAttribute("class", "dataNode");
                                $(".fancytree-folder", data.node.li).append(
                                    dataNode
                                );
                            } else {
                                //remove existing facets
                                $(".dataNode", data.node.li).empty();
                            }

                            _.each(selectedFacets[data.node.title], function (facetValue) {

                                facetFilter = facetValue.value.label;

                                var s_label = document.createElement("SPAN");
                                s_label.setAttribute("class", "facetFilter-label");
                                s_label.setAttribute("title", facetFilter);

                                var length = 15;
                                var facetFilterString = _formatColorText(facetFilter.toString(), length);

                                _.each($.parseHTML(facetFilterString), function (elem) {
                                    s_label.appendChild(elem);
                                });

                                var buttonsSpan = document.createElement("SPAN");
                                buttonsSpan.setAttribute("class", "buttons-span");

                                var s_inverse = document.createElement("A");
                                s_inverse.setAttribute("class", "facetFilter-inverse");

                                var s_closer = document.createElement("A");
                                s_closer.setAttribute("class", "facetFilter-closer");

                                var s_gradient = document.createElement("SPAN");
                                s_gradient.setAttribute("class", "facetFilter-gradient");
                                s_gradient.appendChild(document.createTextNode("\u00A0"));

                                s_label.appendChild(s_gradient);

                                var s_facet = document.createElement("SPAN");
                                s_facet.setAttribute("class", "facetFilter" + '_' + facetValue.mode);
                                s_facet.appendChild(s_label);
                                s_facet.appendChild(buttonsSpan);
                                buttonsSpan.appendChild(s_inverse);
                                buttonsSpan.appendChild(s_closer);

                                $(s_closer).on('click',
                                    function (event) {
                                        event.stopPropagation();
                                        var $facet = $(this).parent().parent();
                                        var facetTitle = $facet.data("facetTitle");
                                        var facetFilter = $facet.data("facetFilter");
                                        var mode = $facet.hasClass("facetFilter_EXCEPT") ? "EXCEPT" : "AND";
                                        selectedFacets[facetTitle] = _.reject(selectedFacets[facetTitle], function (obj) {
                                            return (obj.value.label == facetFilter && obj.mode == mode);
                                        });
                                        _facetCombinedSearch();
                                        return false;
                                    }
                                );

                                $(s_inverse).on('click',
                                    function (event) {
                                        event.stopPropagation();
                                        var $facet = $(this).parent().parent();
                                        var facetTitle = $facet.data("facetTitle");
                                        var facetFilter = $facet.data("facetFilter");
                                        var mode = $facet.hasClass("facetFilter_EXCEPT") ? "EXCEPT" : "AND";
                                        var found = _.find(selectedFacets[facetTitle], function (obj) {
                                            return (obj.value.label == facetFilter && obj.mode == mode);
                                        });
                                        if (found) {
                                            var newMode = mode == "EXCEPT" ? "AND" : "EXCEPT";
                                            found.mode = newMode;
                                            //replace class attr
                                            $facet.filter('.' + "facetFilter" + '_' + mode).removeClass("facetFilter" + '_' + mode).addClass("facetFilter" + '_' + newMode).end();
                                            _facetCombinedSearch();
                                           /* $('#searchForm').submit();*/

                                        }
                                        return false;
                                    }
                                );

                                var newNode = document.createElement('div');
                                newNode.setAttribute("class", "newNode");
                                s_facet = $(newNode.appendChild(s_facet));
                                s_facet.data("facetTitle", data.node.title);
                                s_facet.data("facetFilter", facetFilter);

                                s_facet.hover(function () {
                                    $(buttonsSpan).show();
                                }, function () {
                                    $(buttonsSpan).hide();
                                });

                                $(".fancytree-folder .dataNode", data.node.li).append(
                                    newNode
                                );
                            });
                        }
                    }
                }
            });
        }
        return $facetsTree.fancytree('getTree');
    }

    function _facetCombinedSearch() {
        var q = $('#EDIT_query').val();
        var q_facet_and = "";
        var q_facet_except = "";
        _.each(_.values(selectedFacets), function (facet) {
            _.each(facet, function (facetValue) {
                switch (facetValue.mode) {
                    case "AND":
                        q_facet_and += (q_facet_and ? " AND " : "") + '(' + facetValue.value.query + ')';
                        break;
                    case "EXCEPT":
                        q_facet_except += (q_facet_except ? " OR " : "") + '(' + facetValue.value.query + ')';
                        break;
                }
            });
        });
        if(!q && !q_facet_and && q_facet_except) {
            // too bad : an except with no query.
            q = "created_on>1900/01/01";    // fake "all"
        }
        if(q_facet_and != "") {
            if (q) {
                q = '(' + q + ') AND '
            }
            q += q_facet_and;
        }
        if(q_facet_except != "") {
            q = '(' + q + ') EXCEPT (' + q_facet_except + ')';
        }

        appEvents.emit('search.doCheckFilters');
        appEvents.emit('search.doNewSearch', q);
        // searchModule.newSearch(q);
    }

    function findClauseBy_ux_zone(clause, ux_zone) {
      //  console.log('find clause' + ux_zone);
        if(typeof clause._ux_zone != 'undefined' && clause._ux_zone === ux_zone) {
            return clause;
        }
        if(clause.type === "CLAUSES") {
            for(var i=0; i<clause.clauses.length; i++) {
                var r = findClauseBy_ux_zone(clause.clauses[i], ux_zone);
                if(r != null) {
                    return r;
                }
            }
        }
        return null;
    }
    /**
     * add "field" zone on advsearch
     *
     * @returns {jQuery|HTMLElement}
     * @constructor
     */
    function AdvSearchFacetAddNewTerm() {
        var block_template = $('#ADVSRCH_FIELDS_ZONE DIV.term_select_wrapper_template');
        var last_block = $('#ADVSRCH_FIELDS_ZONE DIV.term_select_wrapper:last');
        if (last_block.length === 0) {
            last_block = block_template;
        }
        last_block = block_template.clone(true).insertAfter(last_block); // true: clone event handlers
        last_block.removeClass('term_select_wrapper_template').addClass('term_select_wrapper').show();
        last_block.css('background-color', '');
        return last_block;
    }
    /**
     * restore the advansearch ux from a json-query
     * elements are restored thank's to custom properties ("_xxx") included in json.
     * nb : for now, _ux_ facets can't be restored _before_sending_the_query_,
     *      but since "selectedFacets" (js) IS restored, sending the query WILL restore facets.
     *
     * @param jsq
     * @param submit
     */
    function restoreJsonQuery(jsq, submit) {
        var clause;
        var facets;

        // restore the "fulltext" input-text
       /* clause = findClauseBy_ux_zone(jsq.query, "FULLTEXT");
        if (clause) {
            $('#EDIT_query').val(clause.value);
        }*/

        // restore the "bases" checkboxes
        if(!_.isUndefined(jsq.bases)) {
            $('#ADVSRCH_SBAS_ZONE .sbas_list .checkbas').prop('checked', false);
            if (jsq.bases.length > 0) {
                for (var k = 0; k < jsq.bases.length; k++) {
                    $('#ADVSRCH_SBAS_ZONE .sbas_list .checkbas[value="' + jsq.bases[k] + '"]').prop('checked', true);
                }
            } else {
                // special case : EMPTY array ==> since it's a nonsense, check ALL bases
                $('#ADVSRCH_SBAS_ZONE .sbas_list .checkbas').prop('checked', true);
            }
        }

        // restore the status-bits (for now dual checked status are restored unchecked)
        if (!_.isUndefined(jsq.statuses)) {
            $('#ADVSRCH_SB_ZONE INPUT:checkbox').prop('checked', false);
            _.each(jsq.statuses, function (db_statuses) {
                let db = db_statuses.databox;
                _.each(db_statuses.status, function (sb) {
                    let i = sb.index;
                    let v = sb.value ? '1' : '0';
                    $("#ADVSRCH_SB_ZONE INPUT[name='status[" + db_statuses.databox + '][' + sb.index + "]'][value=" + v + ']').prop('checked', true);
                });
            });
        }

        // restore the "records/stories" radios
        if (!_.isUndefined(jsq.phrasea_recordtype)) {
            $('#searchForm INPUT[name=search_type][value="' + ((jsq.phrasea_recordtype == 'STORY') ? '1' : '0') + '"]').prop('checked', true);  // check one radio will uncheck siblings
        }

        // restore the "record type" menu (image, video, audio, ...)
        if (!_.isUndefined(jsq.phrasea_mediatype)) {
            $('#searchForm SELECT[name=record_type] OPTION[value="' + jsq.phrasea_mediatype.toLowerCase() + '"]').prop('selected', true);
        }

        // restore the "use truncation" checkbox
        if (!_.isUndefined(jsq.phrasea_mediatype) && jsq.phrasea_mediatype == 'true') {
            $('#ADVSRCH_USE_TRUNCATION').prop('checked', jsq.phrasea_mediatype);
        }

        // restore the "sort results" menus
        if (!_.isUndefined(jsq.sort)) {
            if(!_.isUndefined(jsq.sort.field)) {
                $('#ADVSRCH_SORT_ZONE SELECT[name=sort] OPTION[value="' + jsq.sort.field + '"]').prop('selected', true);
            }
            if(!_.isUndefined(jsq.sort.order)) {
                $('#ADVSRCH_SORT_ZONE SELECT[name=ord] OPTION[value="' + jsq.sort.order + '"]').prop('selected', true);
            }
        }



        // restore the multiples "fields" (field-menu + op-menu + value-input)
        clause = findClauseBy_ux_zone(jsq.query, "FIELDS");
        if (clause) {
            $('#ADVSRCH_FIELDS_ZONE INPUT[name=must_match][value="' + clause.must_match + '"]').attr('checked', true);
            $('#ADVSRCH_FIELDS_ZONE DIV.term_select_wrapper').remove();
            for (var j = 0; j < clause.clauses.length; j++) {
                var wrapper = AdvSearchFacetAddNewTerm();    // div.term_select_wrapper
                var f = $(".term_select_field", wrapper);
                var o = $(".term_select_op", wrapper);
                var v = $(".term_select_value", wrapper);

                f.data('fieldtype', clause.clauses[j].type);
                $('option[value="' + clause.clauses[j].field + '"]', f).prop('selected', true);
                $('option[value="' + clause.clauses[j].operator + '"]', o).prop('selected', true);
                o.prop('disabled', false);
                v.val(clause.clauses[j].value).prop('disabled', false);
            }

        }

        // restore the "date field" (field-menu + from + to)
        clause = findClauseBy_ux_zone(jsq.query, "DATE-FIELD");
        if(clause) {
            $("#ADVSRCH_DATE_ZONE SELECT[name=date_field] option[value='" + clause.field + "']").prop('selected', true);
            $("#ADVSRCH_DATE_ZONE INPUT[name=date_min]").val(clause.from);
            $("#ADVSRCH_DATE_ZONE INPUT[name=date_max]").val(clause.to);
            if ($("#ADVSRCH_DATE_ZONE SELECT[name=date_field]").val() !== '' ) {
                $("#ADVSRCH_DATE_SELECTORS").show();
               // $('#ADVSRCH_DATE_ZONE').addClass('danger');
            }
        }

        // restore the selected facets (whole saved as custom property)
        if(!_.isUndefined(jsq._selectedFacets)) {
            selectedFacets = jsq._selectedFacets;
        }
        if (!_.isUndefined(jsq._facets)) {
             facets = jsq._facets;
        }

        // the ux is restored, finish the job (hide unavailable fields/status etc, display "danger" where needed)
        appEvents.emit('search.doCheckFilters');
         //loadFacets([]);  // useless, facets will be restored after the query is sent

    }

    function serializeJSON(data, selectedFacets, facets) {

        let json = {},
            obj = {},
            bases = [],
            statuses = [],
            fields = [],
            aggregates = []
        ;

        $.each(data, function (i, el) {
            obj[el.name] = el.value;

            let col = parseInt(el.value);

            if (el.name === 'bases[]') {
                bases.push(col);
            }

            if (el.name.startsWith('status')) {
                let databoxId = el.name.match(/\d+/g)[0],
                    databoxRow = el.name.match(/\d+/g)[1],
                    statusMatch = false;

                $.each(statuses, function (i, status) {

                    if (status.databox === databoxId) {
                        // for (var j = 0; j < status.status.length; j++) {
                        //     var st = status.status[j].name;
                        //     var st_id = st.substr(0, st.indexOf(':'));
                        //
                        //     if (st_id === databoxRow) {
                        //         statusMatch = true;
                        //     }
                        // }
                        statuses.splice((databoxId - 1), 1);
                    }

                });

                if (!statusMatch) {
                    statuses.push({
                        'databox': databoxId,
                        'status': [
                            {
                                'index': databoxRow,
                                'value': !!(parseInt(el.value))
                            }
                        ]
                    });
                }
            }
        });

        var _tmpStat = [];
        $('#ADVSRCH_SB_ZONE INPUT[type=checkbox]:checked').each(function (k, o){
            o = $(o);
            var b = o.data('sbas_id');
            var i = o.data('sb');
            var v = o.val();
            if (_.isUndefined(_tmpStat[b])) {
                _tmpStat[b] = [];
            }
            if (_.isUndefined(_tmpStat[b][i])) {
                // first check
                _tmpStat[b][i] = v;
            } else {
                // both checked
                _tmpStat[b][i] = -1;
            }
        });
        _.each(_tmpStat, function(v, sbas_id){
            var status = []
            _.each(v, function(v, sb_index) {
                if (v !== -1) {     // ignore both checked
                    status.push({
                        'index': sb_index,
                        'value': (v === '1')
                    });
                }
            });
            statuses.push({
                'databox': sbas_id,
                'status': status
            });
        });


        $('.term_select_field').each(function (i, el) {
            if ($(el).val()) {
                fields.push({
                    'type': 'TEXT-FIELD',
                    'field': $(el).val(),
                    'operator': $(el).next().val() === ':' ? ":" : "=",
                    'value': $(el).next().next().val(),
                    "enabled": true
                });
            }
        });

        $(facets).each(function (i, el) {

            let facetFilterTitle = el.label,
                facetType = el.type,
                facetField = el.field,
                facetRawVal,
                facetQuery,
                nodeEl,
                negated = false,
                enabled = true
            ;

            $('.fancytree-node.fancytree-folder').each(function (i, node) {
                var nodeTitile = $(node).find('.fancytree-title').text();
                if (nodeTitile === facetFilterTitle) {
                    nodeEl = $(node).find('[class^="facetFilter_"]');
                }
            });

            if (nodeEl !== undefined) {
                if (nodeEl.is('[class$="_EXCEPT"]')) {
                    negated = true;
                }
            }

            _.each(selectedFacets[facetFilterTitle], function (facet) {
                let query = facet.value.query;
                for (let i = 0; i < el.values.length; i++) {
                    if (el.values[i].query === query) {
                        facetRawVal = el.values[i].raw_value;
                        facetQuery = el.values[i].query;
                    }
                }

                if (facetQuery === query) {
                    aggregates.push({
                        'type': facetType,
                        'field': facetField,
                        'value': facetRawVal,
                        'negated': negated,
                        'enabled': enabled
                    });
                }
            });
        });
        var date_field = $('#ADVSRCH_DATE_ZONE select[name=date_field]', 'form.phrasea_query .adv_options').val();
        var date_from  = $('#ADVSRCH_DATE_ZONE input[name=date_min]', 'form.phrasea_query .adv_options').val();
        var date_to    = $('#ADVSRCH_DATE_ZONE input[name=date_max]', 'form.phrasea_query .adv_options').val();

        json['sort'] = {
            'field': obj.sort,
            'order': obj.ord
        };
        json['perpage'] = parseInt($('#nperpage_value').val());
        json['page'] = obj.pag === '' ? 1 : parseInt(obj.pag);
        json['use_truncation'] = obj.truncation === 'on' ? true : false;
        json['phrasea_recordtype'] = obj.search_type == 1 ? 'STORY' : 'RECORD';
        json['phrasea_mediatype'] = obj.record_type.toUpperCase();
        json['bases'] = bases;
        json['statuses'] = statuses;
        json['query'] = {
            '_ux_zone': $('.menu-bar .selectd').text().trim().toUpperCase(),
            'type': 'CLAUSES',
            'must_match': 'ALL',
            'enabled': true,
            'clauses': [
                {
                    '_ux_zone': 'FULLTEXT',
                    'type': 'FULLTEXT',
                    'value': obj.fake_qry,
                    'enabled': obj.fake_qry !== ''
                },
                {
                    '_ux_zone': 'FIELDS',
                    'type': 'CLAUSES',
                    'must_match': obj.must_match,
                    'enabled': true,
                    'clauses': fields
                },
                {
                    '_ux_zone': 'DATE-FIELD',
                    'type': 'DATE-FIELD',
                    'field': date_field,
                    'from': date_from,
                    'to': date_to,
                    "enabled": true
                },
                {
                    '_ux_zone': 'AGGREGATES',
                    'type': 'CLAUSES',
                    'must_match': 'ALL',
                    'enabled': true,
                    'clauses': aggregates
                }
            ]
        };
        json['_selectedFacets'] = selectedFacets;
        json['_facets'] = facets;
        return JSON.stringify(json);
    }
    var _ALL_Clause_ = "(created_on>1900/01/01)";
    function buildQ(clause) {
        if (clause.enabled === false) {
            return "";
        }
        switch (clause.type) {
            case "CLAUSES":
                var t_pos = [];
                var t_neg = [];
                for (var i = 0; i < clause.clauses.length; i++) {
                    var _clause = clause.clauses[i];
                    var _sub_q = buildQ(_clause);
                    if (_sub_q !== "()" && _sub_q !== "") {
                        if (_clause.negated === true) {
                            t_neg.push(_sub_q);
                        } else {
                            t_pos.push(_sub_q);
                        }
                    }
                }
                if (t_pos.length > 0) {
                    // some "yes" clauses
                    if (t_neg.length > 0) {
                        // some "yes" and and some "neg" clauses
                        if (clause.must_match === "ONE") {
                            // some "yes" and and some "neg" clauses, one is enough to match
                            var neg = "(" + _ALL_Clause_ + " EXCEPT (" + t_neg.join(" OR ") + "))";
                            t_pos.push(neg);
                            return "(" + t_pos.join(" OR ") + ")";
                        } else {
                            // some "yes" and and some "neg" clauses, all must match
                            return "((" + t_pos.join(" AND ") + ") EXCEPT (" + t_neg.join(" OR ") + "))";
                        }
                    } else {
                        // only "yes" clauses
                        return "(" + t_pos.join(clause.must_match === "ONE" ? " OR " : " AND ") + ")";
                    }
                } else {
                    // no "yes" clauses
                    if (t_neg.length > 0) {
                        // only "neg" clauses
                        return "(" + _ALL_Clause_ + " EXCEPT (" + t_neg.join(clause.must_match === "ONE" ? " OR " : " AND ") + "))";

                    } else {
                        // no clauses at all
                        return "";
                    }
                }
            case "FULLTEXT":
                return clause.value ? ("(" + clause.value + ")") : "";

            case "DATE-FIELD":
                var t = "";
                if (clause.from) {
                    t = clause.field + ">=" + clause.from;
                }
                if (clause.to) {
                    t += (t ? " AND " : "") + clause.field + "<=" + clause.to;
                }
                return t ? ("(" + t + ")") : '';

            case "TEXT-FIELD":
                return clause.field + clause.operator + "\"" + clause.value + "\"";

            case "GEO-DISTANCE":
                return clause.field + "=\"" + clause.lat + " " + clause.lon + " " + clause.distance + "\"";

            case "STRING-AGGREGATE":
                return clause.field + ":\"" + clause.value + "\"";

            case "COLOR-AGGREGATE":
                return clause.field + ":\"" + clause.value + "\"";

            case "NUMBER-AGGREGATE":
                return clause.field + "=" + clause.value;

            case "BOOL-AGGREGATE":
                return clause.field + "=" + (clause.value ? "1" : "0");

            default :
                console.error("Unknown clause type \"" + clause.type + "\"");
                return null;
        }
    }

    appEvents.listenAll({
        'facets.doLoadFacets': loadFacets,
        'facets.doResetSelectedFacets': resetSelectedFacets,
        'facets.doAddMissingSelectedFacets': facetsAddMissingSelected
    });

    return {
        loadFacets,
        findClauseBy_ux_zone,
        restoreJsonQuery,
        serializeJSON,
        /*facetsAddMissingSelected,*/
        resetSelectedFacets,
        buildQ
    };
};

export default workzoneFacets;

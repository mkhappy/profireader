/**
 * Function calculates difference between two objects/arrays
 * return array or object depending on type of second argument
 * @param {type} a
 * @param {type} b
 * @param {type} notstrict - compare by == if true (if false/ommted by ===)
 * @returns {Array/Object} with elements different in a and b. also if index is present only in one object (a or b)
 * if returened element is array same object are reffered by 'undefined'
 */
function getObjectsDifference(a, b, setval, notstrict) {

    'use strict';

    if ((typeof a !== 'object') || (typeof b !== 'object')) {
        console.log('getObjectsDifference expects both arguments to be array or object');
        return null;
    }

    var ret = $.isArray(b) ? [] : {};

    $.each(a, function (ind, aobj) {
        if ((typeof aobj === 'object') && (typeof b[ind] === 'object')) {
            if ((aobj === null) && (b[ind] === null)) {
                return;
            }
            var nl = getObjectsDifference(aobj, b[ind], setval, notstrict);
            if (!$.isEmptyObject(nl)) {
                ret[ind] = nl;
            }
        }
        else {
            if ((notstrict && (a[ind] == b[ind])) || (!notstrict && (a[ind] === b[ind]))) {
                return;
            }
            ret[ind] = (setval === undefined) ? aobj : setval;
        }
    });
    $.each(b, function (ind, bobj) {
        if ((typeof bobj === 'object') && (typeof a[ind] === 'object')) {

        }
        else {
            if ((notstrict && (a[ind] == b[ind])) || (!notstrict && (a[ind] === b[ind]))) {
                return;
            }
            ret[ind] = (setval === undefined) ? bobj : setval;
        }
    });
    return ret;
}

function quoteattr(s, preserveCR) {
    preserveCR = preserveCR ? '&#13;' : '\n';
    return ('' + s)/* Forces the conversion to string. */
        .replace(/&/g, '&amp;')/* This MUST be the 1st replacement. */
        .replace(/'/g, '&apos;')/* The 4 other predefined entities, required. */
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        /*
         You may add other replacements here for HTML only
         (but it's not necessary).
         Or for XML, only if the named entities are defined in its DTD.
         */
        .replace(/\r\n/g, preserveCR)/* Must be before the next replacement. */
        .replace(/[\r\n]/g, preserveCR);
}


angular.module('profireaderdirectives', ['ui.bootstrap', 'ui.bootstrap.tooltip'])
    .factory('$ok', ['$http', function ($http) {
        return function (url, data, ifok, iferror, translate) {
            //console.log($scope);
            function error(result, error_code) {
                if (iferror) {
                    iferror(result, error_code)
                }
                else {
                    add_message(result, 'danger');
                }
            }

            return $http.post(url, $.extend({}, data, translate ? {__translate: translate} : {})).then(
                function (resp) {
                    if (!resp || !resp['data'] || typeof resp['data'] !== 'object' || resp === null) {
                        return error('wrong response', -1);
                    }

                    resp = resp ['data'];

                    if (!resp['ok']) {
                        return error(resp['data'], resp['error_code']);
                    }

                    if (ifok) {
                        return ifok(resp['data']);
                    }

                },
                function () {
                    return error('wrong response', -1);
                }
            );
        }
    }])
    .directive('prHelpTooltip', ['$compile', '$templateCache', '$controller', function ($compile, $templateCache, $controller) {
        return {
            restrict: 'E',
            link: function (scope, element, attrs) {
                element.html('<span uib-popover-html="\'' + quoteattr(scope.__('help tooltip ' + element.html())) + '\'" ' +
                    'popover-placement="' + (attrs['placement'] ? attrs['placement'] : 'bottom') + '" ' +
                    'popover-trigger="' + (attrs['trigger'] ? attrs['trigger'] : 'mouseenter') + '" ' +
                    'class="' + (attrs['classes'] ? attrs['classes'] : 'glyphicon glyphicon-question-sign') + '"></span>');
                $compile(element.contents())(scope);
            }
        }
    }])
    .directive('prCropper', ['$compile', '$templateCache', '$controller', '$timeout', function ($compile, $templateCache, $controller, $timeout) {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function (scope, element, attrs, model) {

                element.html($templateCache.get('cropper.html'));

                $compile(element.contents())(scope);

                scope.ImageSelected = function (item) {
                    model.$modelValue.coordinates = {rotate: 0};
                    model.$modelValue.image_file_id = item.id;
                    closeFileManager();
                };

                var callback_name = 'prcropper_image_selected_callback_' + scope.controllerName + '_' + randomHash();

                window[callback_name] = scope.ImageSelected;


                scope.chooseImage = function (setImage) {
                    if (setImage) {
                        scope.chooseImageinFileManager("parent." + callback_name, 'choose', '', attrs['prCompanyId']);
                        model.$modelValue.uploaded = false;
                    }
                    else {
                        model.$modelValue.image_file_id = null;
                    }
                };

                var $image = $('img', element);
                var $inputImage = $('input', element);

                var URL = window.URL || window.webkitURL;
                var blobURL;


                var options = {
                    crop: function (e) {
                        if (model.$modelValue) {
                            //e['image_file_id'] = model.$modelValue.image_file_id;
                        }
                        model.$modelValue.coordinates = e;
                    }
                };

                var uploadCropper = function () {
                    var files = this.files;
                    var file;
                    var ff = $('input#inputImage').prop('files')[0];
                    if (files && files.length) {
                        file = files[0];
                        var fr = new FileReader();
                        fr.readAsDataURL(ff);
                        var content = '';
                        fr.onload = function (e) {
                            content = fr.result;
                            if (/^image\/\w+$/.test(file.type)) {
                                $inputImage.val('');
                                blobURL = URL.createObjectURL(file);
                                model.$modelValue.type = file.type;
                                model.$modelValue.name = file.name;
                                model.$modelValue.dataContent = content;
                                model.$modelValue.uploaded = true;
                                model.$modelValue.image_file_id = blobURL;

                            } else {
                                add_message('Please choose an image file.');
                            }
                        };

                    }
                };

                var restartCropper = function () {
                    $image.cropper('destroy');
                    if (model.$modelValue.uploaded) {
                        $image.attr('src', model.$modelValue.image_file_id);
                        $image.cropper(options);
                        $image.cropper('replace', model.$modelValue.image_file_id);
                    }
                    else {
                        if (model.$modelValue.image_file_id) {
                            $image.attr('src', fileUrl(model.$modelValue.image_file_id));
                            $image.cropper(options);
                        }
                        else {
                            $image.attr('src', model.$modelValue.no_image_url);
                        }
                    }
                };

                if (attrs['prCropper']) {
                    scope[attrs['prCropper']] = function () {
                        $image.cropper.apply($image, arguments);
                    };
                }
                //
                scope.$watch(attrs['ngModel'] + '.image_file_id', function () {
                    if (model && model.$modelValue) {
                        //var file_url = fileUrl(model.$modelValue.image_file_id);
                        //$image.attr('src', );
                        //$image.cropper('replace', file_url);

                        if (model) {
                            if (model.$modelValue && model.$modelValue.ratio) options.aspectRatio = model.$modelValue.ratio;
                            if (model.$modelValue && model.$modelValue.coordinates) options.data = model.$modelValue.coordinates;
                        }

                        restartCropper();

                        //
                        //if (file_url) {
                        //
                        //}
                        //else {
                        //    console.log('no image');
                        //}
                    }
                });

                $inputImage.change(uploadCropper);
                //
                //scope.$watch(attrs['ngModel'] + '.ratio', function () {
                //    if (model.$modelValue && model.$modelValue.ratio) {
                //        $image.cropper('setAspectRatio', model.$modelValue.ratio);
                //    }
                //});
                //
                //scope.$watch(attrs['ngModel'] + '.coordinates', function () {
                //    if (model.$modelValue) console.log(model.$modelValue.coordinates);
                //    if (model.$modelValue && model.$modelValue.coordinates) {
                //        options.data = model.$modelValue.coordinates;
                //        restartCropper();
                //        //$image.cropper('setData', model.$modelValue.coordinates);
                //    }
                //});

            }
        };
    }])
    .directive('dateTimestampFormat', function () {
        return {
            require: 'ngModel',
            link: function (scope, element, attr, ngModelCtrl) {
                ngModelCtrl.$formatters.unshift(function (timestamp) {
                    if (timestamp) {
                        var date = new Date(timestamp * 1000);
                        return date;
                    } else
                        return "";
                });
                ngModelCtrl.$parsers.push(function (date) {
                    if (date instanceof Date) {
                        var timestamp = Math.floor(date.getTime() / 1000)
                        return timestamp;
                    } else
                        return "";
                });
            }
        };
    })
    .directive('highlighter', ['$timeout', function ($timeout) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                scope.$watch(attrs.highlighter, function (nv, ov) {
                    if (nv !== ov) {
                        highlight($(element));
                    }
                });
            }
        };
    }])

    .directive('prImage', ['$timeout', function ($timeout) {
        return {
            restrict: 'A',
            scope: {
                prImage: '&',
                prNoImage: '@'
            },
            link: function (scope, element, attrs) {

                var image_reference = attrs['prImage'].split('.').pop();
                var no_image = attrs['prNoImage'] ? attrs['prNoImage'] : false;

                if (!no_image) {
                    no_image = noImageForImageName(image_reference);
                }

                element.attr('src', '/static/images/0.gif');
                element.css({
                    backgroundPosition: 'center',
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundImage: "url('" + fileUrl(scope['prImage'](), false, no_image) + "')"
                });
            }
        };
    }])
    .service('objectTransformation', function () {
        var objectTransformation = {};

        objectTransformation.reverseKeyValue = function (objIn) {
            var objOut = {}, keys, i;
            keys = Object.keys($scope.data.PortalDivisionTags3);
            for (i = 0; i < objIn.length; i++) {
                objOut[objIn[keys[i]]] = keys[i];
            }
            return objOut;
        };

        objectTransformation.getValues1 = function (objList, key, unique) {
            var values = [], value;
            for (var i = 0; i < objList.length; i++) {
                value = objList[i][key];
                if (!unique || (values.indexOf(value) === -1)) {
                    values.push(value);
                }
            }
            return values;
        };

        objectTransformation.getValues2 = function (objList, key1, key2) {
            var resultObject = {}, key, value;
            for (var i = 0; i < objList.length; i++) {
                key = objList[i][key1];
                value = objList[i][key2];

                if (typeof resultObject[key] === 'undefined') {
                    resultObject[key] = [value]
                } else {
                    if (resultObject[key].indexOf(value) === -1) {
                        resultObject[key].push(value)
                    }
                }
            }
            return resultObject;
        };

        objectTransformation.getValues3 = function (objList, key1, key2, key2List) {
            var resultObject = {}, key, i, objFilledWithFalse = {};

            for (i = 0; i < key2List.length; i++) {
                objFilledWithFalse[key2List[i]] = false
            }

            for (i = 0; i < objList.length; i++) {
                key = objList[i][key1];
                if (typeof resultObject[key] === 'undefined') {
                    resultObject[key] = $.extend(true, {}, objFilledWithFalse);
                }
                resultObject[key][objList[i][key2]] = true;
            }

            return resultObject;
        };

        objectTransformation.getValues4 = function (objList, key1, key2, key2List) {
            var resultObject = {}, key, i, objFilledWithFalse = {}, lList, elem;

            lList = [];
            for (i = 0; i < objList.length; i++) {
                elem = objList[i][key1];
                if (lList.indexOf(elem) === -1) {
                    lList.push(elem);
                }
            }

            for (i = 0; i < lList.length; i++) {
                objFilledWithFalse[lList[i]] = false;
            }

            for (i = 0; i < key2List.length; i++) {
                resultObject[key2List[i]] = $.extend(true, {}, objFilledWithFalse);
            }

            for (i = 0; i < objList.length; i++) {
                key = objList[i];
                resultObject[key[key2]][key[key1]] = true;
            }

            return resultObject;
        };

        // substitution in keys is performed
        objectTransformation.subsInKey = function (objIn, objForSubstitution) {
            var keys, i, objOut;

            keys = Object.keys(objIn);
            objOut = {};

            for (i = 0; i < keys.length; i++) {
                objOut[objForSubstitution[keys[i]]] = objIn[keys[i]];
            }

            return objOut;
        };

        // substitution of list elements is performed
        objectTransformation.subsElemOfList = function (listIn, objForSubstitution) {
            var i, listOut;
            listOut = [];
            for (i = 0; i < listIn.length; i++) {
                listOut.push(objForSubstitution[listIn[i]])
            }
            return listOut;
        };

        return objectTransformation;
    })
    .directive('ngOk', ['$http', '$compile', '$ok', function ($http, $compile, $ok) {
        return {
            restrict: 'A',
            scope: {
                ngOnsubmit: '&',
                ngOnsuccess: '&',
                ngOnfail: '&',
                ngAction: '=',
                ngWatch: '@'
            },
            link: function (scope, iElement, iAttrs, ngModelCtrl) {


                if (iAttrs['ngValidationResult']) {
                    scope[iAttrs['ngValidationResult']] = {};
                    var s = scope[iAttrs['ngValidationResult']];

                    s.checking = {};
                    s.checked = {};

                    s.errors = {};
                    s.warnings = {};
                    s.dirty = true;

                    s.submitting = false;
                    s.url = null;
                    s.on_success_url = null;
                }

                iAttrs.$observe('ngAjaxAction', function (value) {
                    s.url = value;
                });

                iAttrs.$observe('ngOnSuccess', function (value) {
                    s.on_success_url = value;
                });


                $.each($('[name]', $(iElement)), function (ind, el) {
                    $newel = $(el).clone();
                    scope.data[$(el).attr('name')] = $(el).val();
                    $newel.attr('ng-model', 'data.' + $newel.attr('name'));
                    $(el).replaceWith($compile($newel)(scope))
                });


                s.getSignificantClass = function (index, one, onw, onn) {

                    if (s.errors && !areAllEmpty(s.errors[index])) {
                        return one;
                    }
                    if (s.warnings && !areAllEmpty(s.warnings[index])) {
                        return onw;
                    }
                    if (s.notices && !areAllEmpty(s.notices[index])) {
                        return onn;
                    }
                    return '';
                };

                s.getSignificantMessage = function (index) {

                    if (s.errors && !areAllEmpty(s.errors[index])) {
                        return s.errors[index][0];
                    }
                    if (s.warnings && !areAllEmpty(s.warnings[index])) {
                        return s.warnings[index][0];
                    }
                    if (s.notices && !areAllEmpty(s.notices[index])) {
                        return s.notices[index][0]
                    }
                    return '';
                };


                s.refresh = function () {
                    s.changed = getObjectsDifference(s.checked, s['data']);
                    s.check();
                };

                s.check = _.debounce(function (d) {
                    if (areAllEmpty(s.checking)) {
                        console.log('s.changed', s.changed);
                        s.changed = getObjectsDifference(s.checked, scope['data']);
                        if (!areAllEmpty(s.changed)) {
                            s.checking = scope['data'];

                            $http.post($(iElement).attr('njAjaxAction'), s.checking)
                                .then(function (fromserver) {
                                    var resp = fromserver['data'];
                                    if (areAllEmpty(getObjectsDifference(s.checking, scope['data']))) {
                                        s.errors = $.extend(true, {}, resp['errors']);
                                        s.warnings = $.extend(true, {}, resp['warnings']);
                                        s.checked = $.extend(true, {}, s.checking);
                                        s.changed = {};
                                        s.checking = {};
                                    }
                                    else {
                                        s.checking = {};
                                        s.refresh();
                                    }
                                }, function () {
                                    s.checking = {};
                                    s.refresh();
                                });
                        }
                    }
                    else {
                        s.refresh();
                    }
                }, 500);
                console.log(iAttrs);
                if (iAttrs['ngAjaxFormValidate'] !== undefined) {
                    s.$watch('data', s.refresh, true);
                    s.refresh();
                }
                s.getTemp(iAttrs.ngCity);
            }
        }
    }]);


areAllEmpty = function () {
    var are = true;

    $.each(arguments, function (ind, object) {
        if (are) {
            var ret = true;
            if ($.isArray(object)) {
                ret = object.length ? false : true;
            }
            else if ($.isPlainObject(object) && $.isEmptyObject(object)) {
                ret = true;
            }
            else {
                ret = ((object === undefined || object === false || object === null || object === 0) ? true : false);
            }
            are = ret;
        }
    });
    return are;
};

function file_choose(selectedfile) {
    var args = top.tinymce.activeEditor.windowManager.getParams();
    var win = (args.window);
    var input = (args.input);
    if (selectedfile['type'] === 'file_video') {
        win.document.getElementById(input).value = "https://youtu.be/" + selectedfile['youtube_data']['id'] + "?list=" + selectedfile['youtube_data']['playlist_id'];
    } else {
        win.document.getElementById(input).value = selectedfile['url'];
    }
    top.tinymce.activeEditor.windowManager.close();
}

// 'ui.select' uses "/static/js/select.js" included in index_layout.html
//module = angular.module('Profireader', ['ui.bootstrap', 'profireaderdirectives', 'ui.tinymce', 'ngSanitize', 'ui.select']);
module = angular.module('Profireader', ['ui.bootstrap', 'profireaderdirectives', 'ui.tinymce', 'ngSanitize', 'ajaxFormModule', 'profireaderdirectives', 'ui.grid', 'ui.grid.pagination', 'ui.grid.edit', 'ngAnimate', 'ngTouch', 'ui.grid.selection', 'ui.grid.grouping', 'ui.grid.treeView', 'ui.slider']);

module.config(function ($provide) {
    $provide.decorator('$controller', function ($delegate) {
        return function (constructor, locals, later, indent) {
            if (typeof constructor === 'string' && !locals.$scope.controllerName) {
                locals.$scope.controllerName = constructor;
            }
            return $delegate(constructor, locals, later, indent);
        };
    });
});

module.controller('filemanagerCtrl', ['$scope', '$modalInstance', 'file_manager_called_for', 'file_manager_on_action',
    'file_manager_default_action', 'get_root',
    function ($scope, $modalInstance, file_manager_called_for, file_manager_on_action, file_manager_default_action, get_root) {

//TODO: SW fix this pls

        closeFileManager = function () {
            $scope.$apply(function () {
                $modalInstance.dismiss('cancel')
            });
        };

        $scope.close = function () {
            $modalInstance.dismiss('cancel');
        };
        $scope.src = '/filemanager/';
        var params = {};
        if (file_manager_called_for) {
            params['file_manager_called_for'] = file_manager_called_for;
        }
        if (file_manager_on_action) {
            params['file_manager_on_action'] = angular.toJson(file_manager_on_action);
        }

        if (file_manager_default_action) {
            params['file_manager_default_action'] = file_manager_default_action;
        }
        if (get_root) {
            params['get_root'] = get_root;
        }
        $scope.src = $scope.src + '?' + $.param(params);
    }]);

module.directive('ngEnter', function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if (event.which === 13) {
                scope.$apply(function () {
                    scope.$eval(attrs.ngEnter, {'event': event});
                });

                event.preventDefault();
            }
        });
    };
});
module.directive('ngDropdownMultiselect', ['$filter', '$document', '$compile', '$parse', '$timeout', '$ok',
    function ($filter, $document, $compile, $parse, $timeout, $ok) {

        return {
            restrict: 'AE',
            scope: {
                addData: '=',
                data:'=',
                send: '=',
                parentScope: '=',
                selectedModel: '=',
                options: '=',
                extraSettings: '=',
                events: '=',
                searchFilter: '=?',
                translationTexts: '=',
                groupBy: '@'
            },
            template: function (element, attrs) {
                var checkboxes = attrs.checkboxes ? true : false;
                var groups = attrs.groupBy ? true : false;

                var template = '<div class="multiselect-parent btn-group dropdown-multiselect" style="width:100%"><div class="kk"><div>';
                template += '<button type="button" style="width:100%"  id="t1" class="dropdown-toggle" ng-class="settings.buttonClasses" ng-click="toggleDropdown()">{{getButtonText()}}&nbsp;<span class="caret"></span></button>';
                template += '<ul class="dropdown-menu dropdown-menu-form ng-dr-ms" ng-style="{display: open ? \'block\' : \'none\', height : settings.scrollable ? settings.scrollableHeight : \'auto\' }" style="position: fixed; top:auto; left: auto; width: 20%" >';
                template += '<li ng-show="settings.selectionLimit === 0"><a data-ng-click="selectAll()"><span class="glyphicon glyphicon-ok"></span>  {{texts.checkAll}}</a>';
                template += '<li ng-show="settings.showUncheckAll"><a data-ng-click="deselectAll(true);"><span class="glyphicon glyphicon-remove"></span>   {{texts.uncheckAll}}</a></li>';
                template += '<li ng-show="(settings.showCheckAll || settings.selectionLimit < 0) && !settings.showUncheckAll" class="divider"></li>';
                template += '<li ng-show="settings.enableSearch"><div class="dropdown-header"><input type="text" class="form-control" style="width: 100%;" ng-model="searchFilter" placeholder="{{texts.searchPlaceholder}}" /></li>';
                template += '<li ng-show="settings.enableSearch" class="divider"></li>';
                if (groups) {
                    template += '<li ng-repeat-start="option in orderedItems | filter: searchFilter" ng-show="getPropertyForObject(option, settings.groupBy) !== getPropertyForObject(orderedItems[$index - 1], settings.groupBy)" role="presentation" class="dropdown-header">{{ getGroupTitle(getPropertyForObject(option, settings.groupBy)) }}</li>';
                    template += '<li ng-repeat-end role="presentation">';
                } else {
                    template += '<li role="presentation" ng-repeat="option in options | filter: searchFilter">';
                }
                template += '<a role="menuitem" tabindex="-1" ng-click="setSelectedItem(getPropertyForObject(option,settings.idProp) , getPropertyForObject(option,settings.displayProp))">';
                if (checkboxes) {
                    template += '<div class="checkbox"><label><input class="checkboxInput" type="checkbox" ng-click="checkboxClick($event, getPropertyForObject(option,settings.idProp))" ng-checked="isChecked(getPropertyForObject(option,settings.idProp), getPropertyForObject(option,settings.displayProp))" /> {{getPropertyForObject(option, settings.displayProp)}}</label></div></a>';
                } else {
                    template += '<span data-ng-class="{\'glyphicon glyphicon-ok\': isChecked(getPropertyForObject(option,settings.idProp), getPropertyForObject(option,settings.displayProp))}"></span> {{getPropertyForObject(option, settings.displayProp)}}</a>';
                }
                template += '</li>';
                template += '<li role="presentation" ng-show="settings.selectionLimit > 1"><a role="menuitem">{{selectedModel.length}} {{texts.selectionOf}} {{settings.selectionLimit}} {{texts.selectionCount}}</a></li>';
                template += '</ul>';
                template += '</div>';

                element.html(template);
            },
            link: function ($scope, $element, $attrs) {
                var $dropdownTrigger = $element.children()[0];

                $scope.toggleDropdown = function (){
                    $scope.open = !$scope.open;
                };

                $scope.checkboxClick = function ($event, id) {
                    $scope.setSelectedItem(id);
                    $event.stopImmediatePropagation();
                };

                $scope.externalEvents = {
                    onItemSelect: angular.noop,
                    onItemDeselect: angular.noop,
                    onSelectAll: angular.noop,
                    onDeselectAll: angular.noop,
                    onInitDone: angular.noop,
                    onMaxSelectionReached: angular.noop
                };

                $scope.settings = {
                    dynamicTitle: true,
                    scrollable: false,
                    scrollableHeight: '300px',
                    closeOnBlur: true,
                    displayProp: 'label',
                    idProp: 'value',
                    externalIdProp: 'value',
                    enableSearch: false,
                    selectionLimit: $scope.addData.limit ? $scope.addData.limit : 0,
                    showCheckAll: true,
                    showUncheckAll: true,
                    closeOnSelect: false,
                    buttonClasses: 'btn btn-default ',
                    closeOnDeselect: false,
                    groupBy: $attrs.groupBy || undefined,
                    groupByTextProvider: null,
                    smartButtonMaxItems: 0,
                    smartButtonTextConverter: angular.noop
                };

                $scope.translate_phrase = function (phrase, dict) {
                    $scope.$$translate = $scope.parentScope.$$translate;
                    return pr_dictionary(phrase, dict, '', $scope, $ok, $scope.parentScope.controllerName)
                };

                $scope.texts = {
                    checkAll: $scope.translate_phrase("Check All"),
                    uncheckAll: $scope.translate_phrase('Uncheck All'),
                    selectionCount: $scope.translate_phrase('checked'),
                    selectionOf: '/',
                    searchPlaceholder: $scope.translate_phrase('Search...'),
                    buttonDefaultText: $scope.translate_phrase('Select'),
                    dynamicButtonTextSuffix: $scope.translate_phrase('checked')
                };

                $scope.searchFilter = $scope.searchFilter || '';

                if (angular.isDefined($scope.settings.groupBy)) {
                    $scope.$watch('options', function (newValue) {
                        if (angular.isDefined(newValue)) {
                            $scope.orderedItems = $filter('orderBy')(newValue, $scope.settings.groupBy);
                        }
                    });
                }

                angular.extend($scope.settings, $scope.extraSettings || []);
                angular.extend($scope.externalEvents, $scope.events || []);
                angular.extend($scope.texts, $scope.translationTexts);

                $scope.singleSelection = $scope.settings.selectionLimit === 1;

                function getFindObj(id) {
                    var findObj = {};

                    if ($scope.settings.externalIdProp === '') {
                        findObj[$scope.settings.idProp] = id;
                    } else {
                        findObj[$scope.settings.externalIdProp] = id;
                    }

                    return findObj;
                }

                function clearObject(object) {
                    for (var prop in object) {
                        delete object[prop];
                    }
                }

                if ($scope.singleSelection) {
                    if (angular.isArray($scope.selectedModel) && $scope.selectedModel.length === 0) {
                        clearObject($scope.selectedModel);
                    }
                }

                if ($scope.settings.closeOnBlur) {
                    $document.on('click', function (e) {
                        var target = e.target.parentElement;
                        var parentFound = false;

                        while (angular.isDefined(target) && target !== null && !parentFound) {
                            if (_.contains(target.className.split(' '), 'multiselect-parent') && !parentFound) {
                                if (target === $dropdownTrigger) {
                                    parentFound = true;
                                }
                            }
                            target = target.parentElement;
                        }

                        if (!parentFound) {
                            $scope.$apply(function () {
                                $scope.open = false;
                            });
                        }
                    });
                }

                $scope.getGroupTitle = function (groupValue) {
                    if ($scope.settings.groupByTextProvider !== null) {
                        return $scope.settings.groupByTextProvider(groupValue);
                    }

                    return groupValue;
                };

                $scope.getButtonText = function () {
                    if (!$scope.listElemens) {
                        $scope.listElemens = {};
                        $scope.listElemens[$scope.addData.field] = []
                    }
                    if ($scope.data.filter[$scope.addData.field]) {
                        $scope.selectedModel = $scope.listElemens[$scope.addData.field]
                    }
                    if ($scope.settings.dynamicTitle && ($scope.selectedModel.length > 0 || (angular.isObject($scope.selectedModel) && _.keys($scope.selectedModel).length > 0))) {
                        if ($scope.settings.smartButtonMaxItems > 0) {
                            var itemsText = [];
                            angular.forEach($scope.options, function (optionItem) {
                                if ($scope.isChecked($scope.getPropertyForObject(optionItem, $scope.settings.idProp))) {
                                    var displayText = $scope.getPropertyForObject(optionItem, $scope.settings.displayProp);
                                    var converterResponse = $scope.settings.smartButtonTextConverter(displayText, optionItem);
                                    itemsText.push(converterResponse ? converterResponse : displayText);
                                }
                            });

                            if ($scope.selectedModel.length > $scope.settings.smartButtonMaxItems) {
                                itemsText = itemsText.slice(0, $scope.settings.smartButtonMaxItems);
                                itemsText.push('...');
                            }

                            return itemsText.join(', ');
                        } else {
                            var totalSelected;
                            if ($scope.singleSelection) {
                                totalSelected = ($scope.selectedModel !== null && angular.isDefined($scope.selectedModel[$scope.settings.idProp])) ? 1 : 0;
                            } else {
                                totalSelected = angular.isDefined($scope.selectedModel) ? $scope.listElemens[$scope.addData.field].length : 0;
                            }

                            if (totalSelected === 0) {
                                return $scope.texts.buttonDefaultText;
                            } else {
                                return totalSelected + ' ' + $scope.texts.dynamicButtonTextSuffix;
                            }
                        }
                    } else {
                        return $scope.texts.buttonDefaultText;
                    }
                };

                $scope.getPropertyForObject = function (object, property) {
                    if (angular.isDefined(object) && object.hasOwnProperty(property)) {
                        return object[property];
                    }
                    return '';
                };

                $scope.selectAll = function () {
                    $scope.isSelectAll = true;
                    $scope.externalEvents.onSelectAll();
                    $scope.listElemens[$scope.addData.field] = [];
                    angular.forEach($scope.options, function (value) {
                        $scope.setSelectedItem(value[$scope.settings.idProp], '', true);
                    });
                    for (var f = 0; f < $scope.selectedModel.length; f++) {
                        $scope.listElemens.push($scope.options[f]['label'])
                    }
                    $scope.data.filter[$scope.addData.field] = $scope.listElemens[$scope.addData.field];
                    $scope.send($scope.data)
                };

                $scope.deselectAll = function (sendEvent) {
                    if (sendEvent) {
                        $scope.isSelectAll = false;
                        delete $scope.data.filter[$scope.addData.field];
                        $scope.send($scope.data);
                        $scope.externalEvents.onDeselectAll();
                        if ($scope.singleSelection) {
                            clearObject($scope.selectedModel);
                        } else {
                            $scope.selectedModel.splice(0, $scope.selectedModel.length);
                        }
                    }
                };

                $scope.setSelectedItem = function (id, label, dontRemove) {
                    var findObj = getFindObj(id);
                    var finalObj = null;
                    if ($scope.settings.externalIdProp === '') {
                        finalObj = _.find($scope.options, findObj);
                    } else {
                        finalObj = findObj;
                    }
                    if ($scope.singleSelection) {
                        clearObject($scope.selectedModel);
                        angular.extend($scope.selectedModel, finalObj);
                        $scope.externalEvents.onItemSelect(finalObj);
                        $scope.listElemens[$scope.addData.field].push(label);
                        $scope.data.filter[$scope.addData.field] = $scope.listElemens[$scope.addData.field];
                        $scope.send($scope.data);
                        if ($scope.settings.closeOnSelect) $scope.open = false;

                        return;
                    }

                    dontRemove = dontRemove || false;
                    var exists = $scope.listElemens[$scope.addData.field].indexOf(label) !== -1;

                    if (!dontRemove && exists) {
                        $scope.externalEvents.onItemDeselect(findObj);
                        index = $scope.listElemens[$scope.addData.field].indexOf(label);
                        $scope.listElemens[$scope.addData.field].splice(index, 1);
                        if ($scope.listElemens[$scope.addData.field].length > 0) {
                            $scope.data.filter[$scope.addData.field] = $scope.listElemens[$scope.addData.field];
                        } else {
                            delete $scope.data.filter[$scope.addData.field];
                        }
                        $scope.send($scope.data)
                    } else if (!exists && ($scope.settings.selectionLimit === 0 || $scope.listElemens[$scope.addData.field].length < $scope.settings.selectionLimit)) {
                        $scope.externalEvents.onItemSelect(finalObj);
                        if (label.length > 0) {
                            var dat = $scope.data
                            $scope.listElemens[$scope.addData.field].push(label);
                            dat.filter[$scope.addData.field] = $scope.listElemens[$scope.addData.field];
                            $scope.send(dat)
                        }
                    }
                    if ($scope.settings.closeOnSelect) $scope.open = false;
                };

                $scope.isChecked = function (id, label) {
                    if ($scope.singleSelection) {
                        return $scope.selectedModel !== null && angular.isDefined($scope.selectedModel[$scope.settings.idProp]) && $scope.selectedModel[$scope.settings.idProp] === getFindObj(id)[$scope.settings.idProp];
                    }
                    if ($scope.isSelectAll) {
                        return true
                    }
                    return $scope.listElemens[$scope.addData.field].indexOf(label) !== -1;
                };

                $scope.externalEvents.onInitDone();
            }
        };
    }]);


function pr_dictionary(phrase, dict, allow_html, scope, $ok, ctrl) {
    allow_html = allow_html ? allow_html : '';
    if (typeof phrase !== 'string') {
        return '';
    }

    if (!scope.$$translate) {
        scope.$$translate = {};
    }
    //console.log(scope.$$translate)
    new Date;
    var t = Date.now() / 1000;

    //TODO OZ by OZ hasOwnProperty
    var CtrlName = scope.controllerName ? scope.controllerName : ctrl;
    if (scope.$$translate[phrase] === undefined) {
        scope.$$translate[phrase] = {'lang': phrase, 'time': t};
        $ok('/tools/save_translate/', {
            template: CtrlName,
            phrase: phrase,
            allow_html: allow_html,
            url: window.location.href
        }, function (resp) {

        });
    }

    if ((t - scope.$$translate[phrase]['time']) > 86400) {
        scope.$$translate[phrase]['time'] = t;
        $ok('/tools/update_last_accessed/', {template: CtrlName, phrase: phrase}, function (resp) {
        });
    }

    if (scope.$$translate[phrase]['allow_html'] !== allow_html) {
        scope.$$translate[phrase]['allow_html'] = allow_html;
        $ok('/tools/change_allowed_html/', {
            template: CtrlName,
            phrase: phrase,
            allow_html: allow_html
        }, function (resp) {
        });
    }

    try {
        var ret = scope.$$translate[phrase]['lang'];
        ret = ret.replace(/%\(([^)]*)\)(s|d|f|m|i)/g, function (g0, g1) {
            var indexes = g1.split('.');
            var d = dict ? dict : scope;

            for (var i in indexes) {
                if (typeof d[indexes[i]] !== undefined) {
                    d = d[indexes[i]];
                }
                else {
                    return g1;
                }
            }
            return d;
        });
        return ret;
    } catch (a) {
        return phrase
    }
}

module.run(function ($rootScope, $ok, $sce, $uibModal, $sanitize, $timeout, $templateCache) {
    //$rootScope.theme = 'bs3'; // bootstrap3 theme. Can be also 'bs2', 'default'
    angular.extend($rootScope, {
        fileUrl: function (file_id, down, if_no_file) {
            return fileUrl(file_id, down, if_no_file);
        },
        highlightSearchResults: function (full_text, search_text) {
            if (search_text !== '' && search_text !== undefined) {
                var re = new RegExp(search_text, "g");
                return $sce.trustAsHtml(full_text.replace(re, '<span style="color:blue">' + search_text + '</span>'));
            }
            return $sce.trustAsHtml(full_text);
        },
        __: function (phrase, dict) {
            return $sce.trustAsHtml(pr_dictionary(phrase, dict, '*', this, $ok));
        },
        _: function (phrase, dict) {
            return pr_dictionary(phrase, dict, '', this, $ok);
        },

        applyGridExtarnals: function (resp) {
            var scope = this;
            var col = scope.gridOptions1.columnDefs;
            scope.listsForMS = {};
            scope.gridOptions1.totalItems = resp.total;
            if (resp.page) {
                scope.gridOptions1.pageNumber = resp.page;
                scope.gridOptions1.paginationCurrentPage = resp.page;
            }
            $timeout(function () {
                $(".ui-grid-filter-select option[value='']").remove();
            }, 0);
            for (var i = 0; i < col.length; i++) {
                if (col[i].filter) {
                    if (col[i].filter.type === 'select') {
                        scope.gridOptions1.columnDefs[i]['filter']['selectOptions'] = resp.grid_filters[col[i].name]
                    } else if (col[i].filter.type === 'multi_select') {
                        scope.gridOptions1.columnDefs[i]['filter']['selectOptions'] = resp.grid_filters[col[i].name];
                        scope.listsForMS[col[i].name] = resp.grid_filters[col[i].name].slice(1);
                    }
                }
            }
            for (var m = 0; m < resp.grid_data.length; m++) {
                if (resp.grid_data[m]['level'])
                    resp.grid_data[m].$$treeLevel = 0
            }
            if (scope.all_grid_data) {
                scope.all_grid_data['editItem'] = {};
            }
        },

        setGridExtarnals: function (gridApi) {
            var scope = this;
            scope.additionalDataForMS = {};
            scope.all_grid_data.paginationOptions.pageSize = $rootScope.gridOptions.paginationPageSize;

            var col = scope.gridOptions1.columnDefs;
            $.each(col, function (ind, c) {
                col[ind] = $.extend({
                    enableSorting: false,
                    enableFiltering: c['filter']?true:false,
                    displayName: c['displayName'] ? c['displayName'] : (c['name'].replace(".", ' ') + ' grid column name')
                }, c);
            });

            scope.gridOptions1.headerTemplate = '<div class="ui-grid-header" ><div class="ui-grid-top-panel"><div class="ui-grid-header-viewport"><div class="ui-grid-header"></div><div class="ui-grid-header-canvas" >' +
                '<div class="ui-grid-header-cell-wrapper" ng-style="colContainer.headerCellWrapperStyle()"><div role="row" class="ui-grid-header-cell-row">' +
                '<div class="ui-grid-header-cell ui-grid-clearfix ui-grid-category" ng-repeat="cat in grid.options.category" ng-if="cat.visible && (colContainer.renderedColumns | filter:{ colDef:{category: cat.name} }).length > 0"> ' +
                '<div class="ui-grid-filter-container"><input type="text" class="ui-grid-filter-input ui-grid-filter-input-{{$index}}" ng-enter="grid.searchItemGrid(cat)" ng-model="cat.filter.text" aria-label="{{colFilter.ariaLabel || aria.defaultFilterLabel}}" placeholder="{{ grid.appScope._(\'search\') }}"> ' +
                '<div role="button" class="ui-grid-filter-button" ng-click="grid.refreshGrid(cat)" ng-if="!colFilter.disableCancelFilterButton" ng-disabled="cat.filter.text === undefined || cat.filter.text === null || cat.filter.text === \'\'" ng-show="cat.filter.text !== undefined && cat.filter.text !== null && cat.filter.text !== \'\'"> <i class="ui-grid-icon-cancel" ui-grid-one-bind-aria-label="aria.removeFilter">&nbsp;</i> </div> </div> ' +
                '<div class="ui-grid-header-cell ui-grid-clearfix" ng-if="col.colDef.category === cat.name" ng-repeat="col in colContainer.renderedColumns | filter:{ colDef:{category: cat.name} }" ui-grid-header-cell col="col" render-index="$index"> <div ng-class="{ \'sortable\': sortable }" class="ng-scope sortable"> <div ui-grid-filter="" ng-show="col.colDef.category !== undefined"></div> </div> </div> </div>' +
                '<div class="ui-grid-header-cell ui-grid-clearfix" ng-if="col.colDef.category === undefined"  ng-repeat="col in colContainer.renderedColumns track by col.colDef.name" ui-grid-header-cell col="col" render-index="$index" ng-style="$index === 0 && colContainer.columnStyle($index)"></div>' +
                '</div></div></div></div></div></div>';

            for (var i = 0; i < col.length; i++) {
                if (col[i].category) {
                    scope.gridOptions1.columnDefs[i].enableFiltering = false
                }
                scope.gridOptions1.columnDefs[i].headerCellTemplate = '<div ng-class="{ \'sortable\': sortable }">' +
                    '<div class="ui-grid-cell-contents" col-index="renderIndex" title="{{ grid.appScope._(col.displayName CUSTOM_FILTERS) }}"> <span>{{ grid.appScope._(col.displayName CUSTOM_FILTERS) }}</span>' +
                    '<span ui-grid-visible="col.sort.direction" ng-class="{ \'ui-grid-icon-up-dir\': col.sort.direction == asc, \'ui-grid-icon-down-dir\': col.sort.direction == desc, \'ui-grid-icon-blank\': !col.sort.direction }"> &nbsp;</span> </div> <div class="ui-grid-column-menu-button" ng-if="grid.options.enableColumnMenus && !col.isRowHeader  && col.colDef.enableColumnMenu !== false" ng-click="toggleMenu($event)" ng-class="{\'ui-grid-column-menu-button-last-col\': isLastCol}">' +
                    ' <i class="ui-grid-icon-angle-down">&nbsp;</i> </div> <div ui-grid-filter></div></div>';
                if (col[i].filter) {
                    if (typeof(col[i].filters) === 'number') {
                        var count = scope.gridOptions1.columnDefs[i].filters;
                        scope.gridOptions1.columnDefs[i].filters = [{}];
                        for (var filt = 1; filt < count; filt++) {
                            scope.gridOptions1.columnDefs[i].filters.push({})
                        }
                    }
                    if (col[i].filter.type === 'input') {
                        scope.gridOptions1.columnDefs[i].filterHeaderTemplate = '<div class="ui-grid-filter-container">' +
                            '<input type="text" class="ui-grid-filter-input ui-grid-filter-input-{{$index}}" ng-enter="grid.searchItemGrid(col)" ng-model="col.filter.text"  aria-label="{{colFilter.ariaLabel || aria.defaultFilterLabel}}">' +
                            '<div role="button" class="ui-grid-filter-button" ng-click="grid.refreshGrid(col)" ng-if="!colFilter.disableCancelFilterButton" ng-disabled="col.filter.text === undefined || col.filter.text === null || col.filter.text === \'\'" ng-show="col.filter.text !== undefined && col.filter.text !== null && col.filter.text !== \'\'">' +
                            '<i class="ui-grid-icon-cancel" ui-grid-one-bind-aria-label="aria.removeFilter">&nbsp;</i></div></div>'
                    } else if (col[i].filter.type === 'date_range') {
                        scope.gridOptions1.columnDefs[i].filters = [{}, {}];
                        scope.gridOptions1.columnDefs[i].width = '25%';
                        scope.gridOptions1.columnDefs[i].filterHeaderTemplate = '<div class="ui-grid-filter-container"><input  style="width: 48%; display: inline" type="date" class="form-control" uib-datepicker-popup ng-model="col.filters[0].term" ng-required="true" datepicker-options="dateOptions" close-text="Close"/>' +
                            '<input style="width: 48%; display: inline" type="date" class="form-control" uib-datepicker-popup ng-model="col.filters[1].term" ng-required="true" datepicker-options="dateOptions" close-text="Close"/>' +
                            '<span class="input-group-btn"></span><div role="button" class="ui-grid-filter-button" ng-click="grid.refreshGrid(col)" ng-if="!colFilter.disableCancelFilterButton" ng-disabled="col.filters[1].term === undefined || col.filters[0].term === undefined" ng-show="col.filters[1].term !== undefined && col.filters[1].term !== \'\' && col.filters[0].term !== undefined && col.filters[0].term !== \'\'">' +
                            '<i class="ui-grid-icon-cancel" ui-grid-one-bind-aria-label="aria.removeFilter" style="right:0.5px;">&nbsp;</i></div></div>'
                    } else if (col[i].filter.type === 'multi_select') {
                        scope.listOfSelectedFilterGrid = [];
                        scope.additionalDataForMS[col[i].name] = {
                            limit: col[i].filter.limit ? col[i].filter.limit : null,
                            type: col[i].filter.type,
                            field: col[i].name
                        };
                        scope.gridOptions1.columnDefs[i].filterHeaderTemplate = '<div class="ui-grid-filter-container"><div ng-dropdown-multiselect="" parent-scope="grid.appScope" data="grid.appScope.all_grid_data" add-data="grid.appScope.additionalDataForMS[col.name]" send="grid.setGridData" options = "grid.appScope.listsForMS[col.name]" selected-model="grid.appScope.listOfSelectedFilterGrid"></div></div>'
                    } else if (col[i].filter.type === 'range') {
                        scope.gridOptions1.columnDefs[i].filters = [{}, {}];
                        scope.gridOptions1.columnDefs[i].filterHeaderTemplate = '<div class="ui-grid-filter-container">' +
                            '<input type="number" class="ui-grid-filter-input ui-grid-filter-input-{{$index}}"  ng-model="col.filters[0].term"  aria-label="{{colFilter.ariaLabel || aria.defaultFilterLabel}}" style="margin-bottom: 10px;width: 100%" placeholder="From:">' +
                            '<input type="number" class="ui-grid-filter-input ui-grid-filter-input-{{$index}}"  ng-model="col.filters[1].term"  aria-label="{{colFilter.ariaLabel || aria.defaultFilterLabel}}" style="margin-bottom: 5px;width: 100%" placeholder="To:">' +
                            '<button class="btn btn-group" ng-click="grid.filterForGridRange(col)" ng-disabled="col.filters[1].term === undefined || col.filters[0].term === undefined || col.filters[1].term === null || col.filters[1].term === \'\' || col.filters[0].term === null || col.filters[0].term === \'\'">Filter</button> ' +
                            '<div role="button" class="ui-grid-filter-button" ng-click="grid.refreshGrid(col)" ng-if="!colFilter.disableCancelFilterButton" ng-disabled="col.filters[1].term === undefined || col.filters[0].term === undefined" ng-show="col.filters[1].term !== undefined && col.filters[1].term !== \'\' && col.filters[0].term !== undefined && col.filters[0].term !== \'\'">' +
                            '<i class="ui-grid-icon-cancel" ui-grid-one-bind-aria-label="aria.removeFilter" style="right:0.5px;top:83%">&nbsp;</i></div></div>'
                    }
                }

                var classes_for_row = col[i].classes + ' pr-grid-cell-type-' + col[i].type + ' pr-grid-cell-column-' + col[i].name.replace(/\./g, '-');

                if (col[i].type === 'link') {
                    var link = 'grid.appScope.' + col[i].href;
                    scope.hideGridLinkIf = col[i].hideIf;
                    scope.gridOptions1.columnDefs[i].cellTemplate = '<div class="' + classes_for_row + '" title="{{ COL_FIELD }}"><a ng-if="grid.appScope.hideGridLinkIf !== COL_FIELD" href="{{' + link + '}}" ng-bind="COL_FIELD"></a><div ng-if="grid.appScope.hideGridLinkIf === COL_FIELD">{{ COL_FIELD }}</div></div>'
                } else if (col[i].type === 'img') {
                    scope.gridOptions1.columnDefs[i].cellTemplate = '<div class="' + classes_for_row + '" style="text-align:center;"><img ng-src="{{ COL_FIELD }}" alt="image" style="background-position: center; height: 30px;text-align: center; background-repeat: no-repeat;background-size: contain;"></div>'
                } else if (col[i].type === 'actions') {
                    scope.gridOptions1.columnDefs[i].cellTemplate = '<div class="' + classes_for_row + '"><button class="btn pr-grid-cell-type-actions-button-action-{{ action_name }}" ng-repeat="action_name in COL_FIELD" ng-click="grid.appScope.' + col[i]['onclick'] + '(row.entity.id, \'{{ action_name }}\', row.entity, \'' + col[i]['name'] + '\')" title="{{ grid.appScope._(\'grid action \' + action_name) }}">{{ grid.appScope._(\'grid action \' + action_name) }}</button></div>'
                } else if (col[i].type === 'editable') {
                    if (col[i].multiple === true && col[i].rule) {
                        scope.gridOptions1.columnDefs[i].cellTemplate = '<div class="' + classes_for_row + '" ng-if="grid.appScope.' + col[i].rule + '=== false" title="{{ COL_FIELD }}">{{ COL_FIELD }}</div><div ng-if="grid.appScope.' + col[i].rule + '"><div ng-click="' + col[i].modal + '" title="{{ COL_FIELD }}" id=\'grid_{{row.entity.id}}\'>{{ COL_FIELD }}</div></div>'
                    }
                    if (col[i].subtype && col[i].subtype === 'tinymce') {
                        scope.gridOptions1.columnDefs[i].cellTemplate = '<div class="' + classes_for_row + '" ng-click="' + col[i].modal + '" title="{{ COL_FIELD }}" id=\'grid_{{row.entity.id}}\'>{{ COL_FIELD }}</div>'
                    }
                } else {
                    scope.gridOptions1.columnDefs[i].cellTemplate = '<div class="' + classes_for_row + '" title="{{ COL_FIELD }}">{{ COL_FIELD }}</div>'
                }
            }
            scope.gridApi = gridApi;

            scope.gridApi.grid['searchItemGrid'] = function (col) {
                scope.all_grid_data.paginationOptions.pageNumber = 1;
                scope.all_grid_data['filter'][col.field] = col.filter.text;
                scope.gridApi.grid.setGridData(scope.all_grid_data)
            };

            scope.gridApi.grid['setGridData'] = function (all_grid_data) {
                scope.gridOptions1.loadGridData(all_grid_data, function (grid_data) {
                    scope.initGridData = grid_data;
                    scope.applyGridExtarnals(grid_data);
                });
            };
            if (!scope.load_contr) {
                scope.gridApi.grid.setGridData(scope.all_grid_data)
            }


            scope.gridApi.grid['filterForGridRange'] = function (col) {
                from = col.filters[0]['term'];
                to = col.filters[1]['term'];
                scope.all_grid_data['filter'][col.field] = {'from': from, 'to': to};
                scope.gridApi.grid.setGridData(scope.all_grid_data);
            };

            scope.gridApi.grid['refreshGrid'] = function (col) {
                if (col !== undefined) {
                    if (col.filters && (col.filter.type === 'date_range' || col.filter.type === 'range')) {
                        col.filters[0] = '';
                        col.filters[1] = '';
                    } else if (col.filter.type === 'input') {
                        col.filter.text = '';
                    }
                    delete scope.all_grid_data['filter'][col.field];
                    scope.gridApi.grid.setGridData(scope.all_grid_data)
                }
            };


            scope.gridApi.grid['pr_take_action'] = function (id, action, row) {
                console.log('pr_take_action', id, action, row);
            };
            scope.gridApi.grid['pr_build_actions_buttons'] = function (id, actions, row) {
                var ret =
                    $sce.trustAsHtml(_.map(actions, function (action) {
                        return '<button ng-click="grid.appScope.pr_take_action(row.entity.id, \'' + action + '\', row.entity)">' + action + '</button>'
                    }).join('&nbsp;'));

                return ret;
                //console.log('pr_build_actions_buttons', id, actions, row);
            };

            scope.gridApi.core.on.sortChanged(scope, function (grid, sortColumns) {
                scope.all_grid_data['sort'] = {};
                if (sortColumns.length !== 0) {
                    scope.all_grid_data['sort'][sortColumns[0].field] = sortColumns[0].sort.direction;
                }
                scope.gridApi.grid.setGridData(scope.all_grid_data)
            });

            gridApi.edit.on.afterCellEdit(scope, function (rowEntity, colDef, newValue, oldValue) {
                if (newValue !== oldValue) {
                    scope.all_grid_data['editItem'] = {
                        'name': rowEntity.name,
                        'newValue': newValue,
                        'template': rowEntity.template,
                        'col': colDef.name
                    };
                    scope.all_grid_data.paginationOptions.pageNumber = 1;
                    scope.gridApi.grid.setGridData(scope.all_grid_data)
                }
            });

            if (scope.gridOptions1.paginationTemplate) {
                gridApi.pagination.on.paginationChanged(scope, function (newPage, pageSize) {
                    scope.all_grid_data.paginationOptions.pageNumber = newPage;
                    scope.all_grid_data.paginationOptions.pageSize = pageSize;
                    $timeout(function () {
                        scope.gridApi.grid.setGridData(scope.all_grid_data)
                    }, 500)

                });
            }

            gridApi.core.on.filterChanged(scope, function () {
                var grid = this.grid;
                var at_least_one_filter_changed = false;
                for (var i = 0; i < grid.columns.length; i++) {

                    var term = grid.columns[i].filter.term;
                    var type = grid.columns[i].filter.type;
                    var field = grid.columns[i].name;

                    if (type === 'date_range') {
                        if (grid.columns[i].filters[0].term && grid.columns[i].filters[1].term) {
                            at_least_one_filter_changed = true;
                            var offset = new Date().getTimezoneOffset();
                            var from = new Date(grid.columns[i].filters[0].term).getTime();
                            var to = new Date(grid.columns[i].filters[1].term).getTime();
                            var error = from - to >= 0;
                            scope.all_grid_data['filter'][field] = {
                                'from': from - (offset * 60000),
                                'to': to - (offset * 60000)
                            };
                        }
                    } else if (term !== undefined) {
                        if (term !== scope.all_grid_data['filter'][field]) {
                            at_least_one_filter_changed = true;
                            term != null ? scope.all_grid_data['filter'][field] = term : delete scope.all_grid_data['filter'][field]
                        }
                    }
                }
                if (at_least_one_filter_changed) {
                    error ? add_message('You push wrong date', 'danger', 3000) : scope.gridApi.grid.setGridData(scope.all_grid_data)
                }
            });

            if (scope.gridOptions1.enableRowSelection) {
                gridApi.selection.on.rowSelectionChanged(scope, function (row) {
                    scope.list_select = scope.gridApi.selection.getSelectedRows();
                    scope.isSelectedRows = scope.gridApi.selection.getSelectedRows().length !== 0;
                });
            }
        },
        gridOptions: {
            data: 'initGridData.grid_data',
            onRegisterApi: function (gridApi) {
                gridApi.grid.appScope.setGridExtarnals(gridApi)
            },
            paginationPageSizes: [1, 10, 25, 50, 75, 100, 1000],
            paginationPageSize: 50,
            enableColumnMenu: false,
            enableFiltering: true,
            enableCellEdit: false,
            useExternalPagination: true,
            useExternalSorting: true,
            useExternalFiltering: true,
            enableColumnMenus: false,
            showTreeExpandNoChildren: false,
            groupingShowGroupingMenus: false,
            groupingShowAggregationMenus: false,
            columnDefs: []
        },
        all_grid_data: {
            paginationOptions: {pageNumber: 1, pageSize: 1},
            filter: {},
            sort: {},
            editItem: {}
        },
        loadData: function (url, senddata, beforeload, afterload) {
            var scope = this;
            scope.loading = true;
            $ok(url ? url : '', senddata ? senddata : {}, function (data) {
                if (!beforeload) beforeload = function (d) {
                    return d;
                };
                scope.data = beforeload(data);
                scope.original_data = $.extend(true, {}, scope.data);
                if (afterload) afterload();

            }).finally(function () {
                scope.loading = false;
            });
        },
        areAllEmpty: areAllEmpty,
        chooseImageinFileManager: function (do_on_action, default_action, callfor, id) {
            var scope = this;
            var callfor_ = callfor ? callfor : 'file_browse_image';
            var default_action_ = default_action ? default_action : 'file_browse_image';
            var root_id = id ? id : '';
            scope.filemanagerModal = $uibModal.open({
                templateUrl: 'filemanager.html',
                controller: 'filemanagerCtrl',
                size: 'filemanager-halfscreen',
                resolve: {
                    file_manager_called_for: function () {
                        return callfor_
                    },
                    file_manager_on_action: function () {
                        return {
                            choose: do_on_action
                        }
                    },
                    file_manager_default_action: function () {
                        return default_action_
                    },
                    get_root: function () {
                        return root_id
                    }
                }
            });
        },
        dateOptions: {
            formatYear: 'yy',
            startingDay: 1
        },
        tinymceImageOptions: {
            inline: false,
            menu: [],
            plugins: 'advlist autolink link image charmap print paste table media',
            skin: 'lightgray',
            theme: 'modern',
            'toolbar1': "undo redo | bold italic | alignleft aligncenter alignright alignjustify | styleselect | bullist numlist outdent indent | media link image table",
            //'toolbar1': "undo redo | bold italic | alignleft aligncenter alignright alignjustify | styleselect | bullist numlist outdent indent | link image table"[*],
            'valid_elements': "iframe[*],img[*],table[*],tbody[*],td[*],th[*],tr[*],p[*],h1[*],h2[*],h3[*],h4[*],h5[*],h6[*],div[*],ul[*],ol[*],li[*],strong/b[*],em/i[*],span[*],blockquote[*],sup[*],sub[*],code[*],pre[*],a[*]",
            //init_instance_callback1: function () {
            //    console.log('init_instance_callback', arguments);
            //},
            file_browser_callback: function (field_name, url, type, win) {
                var cmsURL = '/filemanager/?file_manager_called_for=file_browse_' + type +
                    '&file_manager_default_action=choose&file_manager_on_action=' + encodeURIComponent(angular.toJson({choose: 'parent.file_choose'}));
                tinymce.activeEditor.windowManager.open({
                        file: cmsURL,
                        width: 950,  // Your dimensions may differ - toy around with them!
                        height: 700,
                        resizable: "yes",
                        //inline: "yes",  // This parameter only has an effect if you use the inlinepopups plugin!
                        close_previous: "yes"
                    }
                    ,
                    {
                        window: win,
                        input: field_name
                    }
                )
                ;

            },
            //valid_elements: Config['article_html_valid_elements'],
            //valid_elements: 'a[class],img[class|width|height],p[class],table[class|width|height],th[class|width|height],tr[class],td[class|width|height],span[class],div[class],ul[class],ol[class],li[class]',
            content_css: ["/static/front/css/bootstrap.css", "/static/css/article.css", "/static/front/bird/css/article.css"],


            //paste_auto_cleanup_on_paste : true,
            //paste_remove_styles: true,
            //paste_remove_styles_if_webkit: true,
            //paste_strip_class_attributes: "all",

            //style_formats: [
            //    {title: 'Bold text', inline: 'b'},
            //    {title: 'Red text', inline: 'span', styles: {color: '#ff0000'}},
            //    {title: 'Red header', block: 'h1', styles: {color: '#ff0000'}},
            //
            //    {
            //        title: 'Image Left',
            //        selector: 'img',
            //        styles: {
            //            'float': 'left',
            //            'margin': '0 10px 0 10px'
            //        }
            //    },
            //    {
            //        title: 'Image Right',
            //        selector: 'img',
            //        styles: {
            //            'float': 'right',
            //            'margin': '0 0 10px 10px'
            //        }
            //    }
            //]

        }
    })
});


function cleanup_html(html) {
    normaltags = '^(span|a|br|div|table)$';
    common_attributes = {
        whattr: {'^(width|height)$': '^([\d]+(.[\d]*)?)(em|px|%)$'}
    };

    allowed_tags = {
        '^table$': {allow: '^(tr)$', attributes: {whattr: true}},
        '^tr$': {allow: '^(td|th)$', attributes: {}},
        '^td$': {allow: normaltags, attributes: {whattr: true}},
        '^a$': {allow: '^(span)$', attributes: {'^href$': '.*'}},
        '^img$': {allow: false, attributes: {'^src$': '.*'}},
        '^br$': {allow: false, attributes: {}},
        '^div$': {allow: normaltags, attributes: {}}
    };

    $.each(allowed_tags, function (tag, properties) {
        var attributes = properties.attributes ? properties.attributes : {}
        $.each(attributes, function (attrname, allowedvalus) {
            if (allowedvalus === true) {
                allowed_tags[tag].attributes[attrname] = common_attributes[attrname] ? common_attributes[attrname] : '.*';
            }
        });
    });

    var tags = html.split(/<[^>]*>/);

    $.each(tags, function (tagindex, tag) {
        console.log(tagindex, tag);
    });

    return html;
}


None = null;
False = false;
True = true;


//TODO: RP by OZ:   pls rewrite this two functions as jquery plugin

function scrool($el, options) {
    $.smoothScroll($.extend({
        scrollElement: $el.parent(),
        scrollTarget: $el
    }, options ? options : {}));
}

function highlight($el) {
    $el.addClass('highlight');
    setTimeout(function () {
        $el.removeClass('highlight');
    }, 500);
}

function angularControllerFunction(controller_attr, function_name) {
    var nothing = function () {
    };
    var el = $('[ng-controller=' + controller_attr + ']');
    if (!el && !el.length) return nothing;
    if (!angular.element(el[0])) return nothing;
    if (!angular.element(el[0]).scope()) return nothing;
    if (!angular.element(el[0]).scope()) return nothing;
    var func = angular.element(el[0]).scope()[function_name];
    var controller = angular.element(el[0]).controller();
    return (func && controller) ? func : nothing;
}

function fileUrl(id, down, if_no_file) {

    if (!id) return (if_no_file ? if_no_file : '');

    if (!id.match(/^[^-]*-[^-]*-4([^-]*)-.*$/, "$1")) return (if_no_file ? if_no_file : '');

    var server = id.replace(/^[^-]*-[^-]*-4([^-]*)-.*$/, "$1");
    if (down) {
        return '//file' + server + '.profireader.com/' + id + '?d'
    } else {
        return '//file' + server + '.profireader.com/' + id + '/'
    }
}

function cloneObject(o) {
    return (o === null || typeof o !== 'object') ? o : $.extend(true, {}, o);
}

function add_message(amessage, atype, atime) {
    return angularControllerFunction('message-controller', 'add_message')(amessage, atype, atime);
}

function randomHash() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 32; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

function buildAllowedTagsAndAttributes() {

    var class_prefix_general = 'pr_article_';
    var class_prefix_theme = 'pr_article_birdy';

    var general_classes = {
        'text_size': 'big,bigger,biggest,smallest,small,smaller,normal',
        'text_decoration': 'underline,normal',
        'text_style': 'b,i',
        'text_script': 'sup,sub',
        'float': 'left,right'
    };

    var theme_classes = {
        'text_color': 'red,gray,normal',
        'background_color': 'gray,normal'
    };

    var text_classes = ['text_size', 'text_decoration', 'text_style', 'text_script', 'text_color', 'background_color'];
    var layout_classes = ['float'];
    var wh_styles = {'width': '^[^d]*(px|em)$', 'height': '^[^d]*(px|em)$'};

    var allowed_tags_skeleton = [
        {
            tags: 'div,table,columns',
            classes: [].concat(text_classes, layout_classes)
        },
        {
            tags: 'div,table',
            styles: wh_styles
        },
        {
            tags: 'img',
            styles: wh_styles,
            classes: layout_classes
        },
        {
            tags: 'columns',
            attributes: {'number': '.*'}
        }
    ];

    var allowed_tags = {};
    $.each(allowed_tags_skeleton, function (del_ind, tags_and_properties) {

        var tags = tags_and_properties['tags'].split(',');

        var styles = tags_and_properties['styles'] ? tags_and_properties['styles'] : {};
        var attributes = tags_and_properties['attributes'] ? tags_and_properties['attributes'] : {};
        var classes = tags_and_properties['classes'] ? tags_and_properties['classes'] : {};


        $.each(tags, function (del_ind2, tag) {

            if (!allowed_tags[tag]) allowed_tags[tag] = {'classes': [], 'attributes': {}, 'styles': {}};

            $.each(styles, function (style_name, allowed_style_regexp) {
                if (allowed_tags[tag]['styles'][style_name]) {
                    console.error('error. regexp for style `' + style_name + '` for tag `' + tag + '` already defined as `' + allowed_tags[tag]['styles'][style_name] + '` ignored');
                }
                else {
                    allowed_tags[tag]['styles'][style_name] = allowed_style_regexp;
                }
            });

            $.each(attributes, function (attr_name, allowed_attr_regexp) {
                if (allowed_tags[tag]['attributes'][attr_name]) {
                    console.error('error. regexp for attribute `' + attr_name + '` for tag `' + tag + '` already defined as `' + allowed_tags[tag]['attributes'][attr_name] + '` ignored');
                }
                else {
                    allowed_tags[tag]['attributes'][attr_name] = allowed_attr_regexp;
                }
            });

            $.each(classes, function (del_ind3, classes_group_index) {
                if (theme_classes[classes_group_index]) {
                    class_sufixes = theme_classes[classes_group_index];
                }
                else if (general_classes[classes_group_index]) {
                    class_sufixes = general_classes[classes_group_index];
                }

                if (!class_sufixes) {
                    console.error('error. unknown class group index `' + classes_group_index + '` for tag `' + tag + '`. ignored');
                }
                else {
                    if (!allowed_tags[tag]['classes'][classes_group_index]) allowed_tags[tag]['classes'][classes_group_index] = [];
                    allowed_tags[tag]['classes'][classes_group_index] = [].concat(allowed_tags[tag]['classes'][classes_group_index],
                        _.map(class_sufixes.split(','), function (classsufix) {
                            return 'pr_article_' + classes_group_index + '_' + classsufix;
                        }));
                }
            });
        });
    });

    return allowed_tags;
}

function find_and_build_url_for_endpoint(dict, rules) {
    var found = false;
    var dict1 = {};
    $.each(rules, function (ind, rule) {
        var ret = rule;
        var prop = null;
        var dict1 = $.extend({}, dict);
        for (prop in dict1) {
            ret = ret.replace('<' + prop + '>', dict[prop]);
            delete dict1[prop];
        }
        if (!ret.match('<[^<]*>')) {
            found = ret;
            return false;
        }
    });

    if (found === false) {
        console.error('Can\'t found flask endpoint for passed dictionary', dict, rules);
    }
    else {
        if (_.size(dict1) > 0) {
            console.warn("To many parameters passed in dictionary for endpoint rule", dict, rules);
        }
        return found;
    }
}

var compile_regexps = function (format_properties) {
    //var rem = format_properties['remove_classes_on_apply'] ?
    //    RegExp('^' + format_properties['remove_classes_on_apply'] + '$', "i") : false;
    //console.log(format_properties);

    var rem = false;
    if (format_properties['remove_classes_on_apply']) {
        rem = {};
        $.each(format_properties['remove_classes_on_apply'], function (del, class_to_rem) {
            rem[class_to_rem] = RegExp('^' + class_to_rem + '$', "i")
        });
    }

    var add = false;
    if (format_properties['add_classes_on_apply']) {
        add = {};
        $.each(format_properties['add_classes_on_apply'], function (class_to_add, check_if_not_exust) {
            add[class_to_add] = RegExp('^' + check_if_not_exust + '$', "i")
        });
    }
    delete format_properties['add_classes_on_apply'];
    delete format_properties['remove_classes_on_apply'];
    //console.log({remove: rem, add: add});
    return {remove: rem, add: add};
};

var add_or_remove_classes = function (element, classes, remove, add) {

    console.log(element, classes, remove, add);

    classes.map(function (class_name) {
        if (add) {
            $.each(add, function (add_if_not_exist, check_if_exist) {
                if (check_if_exist && class_name.match(check_if_exist)) {
                    delete add[add_if_not_exist];
                }
            });
        }
    });

    $.each(add, function (add_if_not_exist, check_if_exist) {
        $(element).addClass(add_if_not_exist);
    });

    $.each(remove, function (del, remove_regexp) {
        classes.map(function (class_name) {
            if (class_name.match(remove_regexp))
                $(element).removeClass(class_name);
        });

    });
};

var extract_formats_items_from_group = function (formats_in_group) {
    var ret = [];
    $.each(formats_in_group, function (format_name, format) {
        ret.push(
            {title: format_name.replace(/.*_(\w+)$/, '$1'), format: format_name});
    });
    return ret;
}


var get_complex_menu = function (formats, name, subformats) {
    var ret = [];
    $.each(subformats, function (del, group_label) {
        ret.push({
            'title': group_label,
            items: extract_formats_items_from_group(formats[name + '_' + group_label])
        });
    });
    return ret;
}

var get_array_for_menu_build = function (formats) {
    var menu = {};
    menu['foreground'] = [{items: extract_formats_items_from_group(formats['foreground_color'])}];
    menu['background'] = [{items: extract_formats_items_from_group(formats['background_color'])}];
    menu['font'] = [{items: extract_formats_items_from_group(formats['font_family'])}];
    menu['border'] = get_complex_menu(formats, 'border', ['placement', 'type', 'width', 'color']);
    menu['margin'] = get_complex_menu(formats, 'margin', ['placement', 'size']);
    menu['padding'] = get_complex_menu(formats, 'padding', ['placement', 'size']);


    //menu['background_color'] = {
    //    'title': 'background',
    //    'items': extract_formats_items_from_group(formats['background_color'])
    //};
    //menu['font_family'] = {'title': 'font', 'items': extract_formats_items_from_group(formats['font_family'])};
    //
    //$.each(formats, function (format_group_name, formats_in_group) {
    //    var ret1 = {'title': format_group_name, 'items': []};
    //    $.each(formats_in_group, function (format_name, format) {
    //        ret1['items'].push(
    //            {title: format_name.replace(/.*_(\w+)$/, '$1'), format: format_name});
    //    });
    //    ret.push(ret1);
    //});
    return menu;
};


var convert_python_format_to_tinymce_format = function (python_format) {

    if (python_format['remove_classes_on_apply'] || python_format['add_classes_on_apply']) {

        var rem_add = compile_regexps(python_format);

        python_format['onformat'] = function (DOMUtils, element) {
            var classes = $(element).attr('class');
            add_or_remove_classes(element, classes ? classes.split(/\s+/) : [], rem_add['remove'], rem_add['add']);
        }
    }
    return python_format;
};


var noImageForImageName = function (image_name) {
    if (image_name === 'logo_file_id') {
        return '/static/images/company_no_logo.png';
    }
    else {
        return '/static/images/no_image.png';
    }
}



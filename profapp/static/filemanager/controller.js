(function (window, angular, $) {
    "use strict";
    angular.module('FileManagerApp').controller('FileManagerCtrl', ['$http',
        '$scope', '$translate', '$cookies', '$timeout', 'fileManagerConfig', 'item', 'Upload', 'fileNavigator', 'fileUploader','$q',
        function ($http, $scope, $translate, $cookies, $timeout, fileManagerConfig, Item, Upload, FileNavigator, fileUploader, $q) {

            $scope.config = fileManagerConfig;
            $scope.appName = fileManagerConfig.appName;
            $scope.path_profireader = 'http://profireader.com';
            $scope.orderProp = ['model.type', 'model.name'];
            $scope.query = '';
            $scope.temp = new Item();
            $scope.fileNavigator = new FileNavigator(_.keys(library)[0], file_manager_called_for);
            $scope.fileUploader = fileUploader;
            $scope.uploadFileList = [];
            $scope.viewTemplate = $cookies.viewTemplate || 'main-table.html';
            $scope.error = error;
            $scope.rootdirs = library;
            $scope.file_manager_called_for = file_manager_called_for;
            $scope.file_manager_on_action = file_manager_on_action;
            $scope.file_manager_default_action = file_manager_default_action;
            $scope.root_id = '';
            $scope.root_name = '';
            $scope.copy_file_id = '';
            $scope.cut_file_id = '';
            $scope.timer = false;
            $scope.name = '';
            $scope.upload_file_id = '';

            $scope.last_visit = document.referrer;

            $scope.setTemplate = function (name) {
                $scope.viewTemplate = $cookies.viewTemplate = name;
            };

            $scope.changeRoot = function (root_id, root_name) {
                $scope.fileNavigator.setRoot(root_id);
                $scope.root_name = root_name;
            };

            $scope.touch = function (item) {
                item = item instanceof Item ? item : new Item();
                item.revert && item.revert();
                $scope.temp = item;
            };

            $scope.smartClick = function (item) {
                if (item.isFolder()) {
                    return $scope.fileNavigator.folderClick(item);
                }
                if (item.isImage()) {
                    if ($scope.file_manager_default_action === 'choose') {
                        try {
                            eval($scope.file_manager_on_action['choose'] + '(item.model);');
                        }
                        catch (e) {

                        }
                    } else {
                        try {
                            eval('item' + '.' + 'download' + '();');//$scope.file_manager_on_action[actionname] + '(item);');
                        }
                        catch (e) {

                        }
                    }
                }
                if (item.isEditable()) {
                    item.getContent();
                    $scope.touch(item);
                    $('#edit').modal('show');
                    return;
                }
            };

            $scope.isInThisPath = function (path) {
                var currentPath = $scope.fileNavigator.currentPath.join('/');
                return currentPath.indexOf(path) !== -1;
            };

            $scope.edit = function (item) {
                item.edit(function () {
                    $('#edit').modal('hide');
                });
            };

            $scope.changePermissions = function (item) {
                item.changePermissions(function () {
                    $('#changepermissions').modal('hide');
                });
            };

            $scope.search = function (query) {
                $scope.fileNavigator.search(query, $scope.fileNavigator.getCurrentFolder());
            };


            $scope.cut = function (item) {
                $scope.cut_file_id = $cookies.cut_file_id = item.model.id;
                $scope.copy_file_id = $cookies.copy_file_id = '';
                item.cut(function () {
                    $scope.fileNavigator.refresh();
                });
            };

            $scope.copy = function (item) {
                $scope.copy_file_id = $cookies.copy_file_id = item.model.id;
                $scope.cut_file_id = $cookies.cut_file_id = '';
                item.copy(function () {
                    $scope.fileNavigator.refresh();
                });
            };

            $scope.time_out = function () {
                $scope.timer = True;
                $timeout(function () {
                    $scope.timer = False
                }, 2000);
            };


            $scope.paste = function (item) {
                if ($scope.copy_file_id !== '' && $scope.cut_file_id === '') {
                    item.tempModel.mode = 'copy';
                    item.tempModel.id = $scope.copy_file_id;
                    item.tempModel.error = $translate.instant('error_copy');
                } else if ($scope.copy_file_id == '' && $scope.cut_file_id != '') {
                    item.tempModel.mode = 'cut';
                    item.tempModel.id = $scope.cut_file_id;
                    item.tempModel.error = $translate.instant('error_cut');
                }
                item.tempModel.len = $scope.fileNavigator.fileList.length;
                item.tempModel.time_o = $scope.time_out();
                item.tempModel.folder_id = $scope.fileNavigator.getCurrentFolder();
                item.paste(function () {
                    $scope.fileNavigator.refresh();
                    $scope.cut_file_id = $cookies.cut_file_id = '';
                    $scope.copy_file_id = $cookies.copy_file_id = ''
                });
            };

            $scope.compress = function (item) {
                item.compress(function () {
                    item.success = true;
                    $scope.fileNavigator.refresh();
                }, function () {
                    item.success = false;
                });
            };

            $scope.extract = function (item) {
                item.extract(function () {
                    item.success = true;
                    $scope.fileNavigator.refresh();
                }, function () {
                    item.success = false;
                });
            };

            $scope.remove = function (item) {
                item.tempModel.error = $translate.instant('error_remove');
                item.remove(function () {
                    $scope.fileNavigator.refresh();
                    $('#remove').modal('hide');
                });
            };

            $scope.set_property = function (item) {
                if ($scope.fileNavigator.fileNameExists(item.tempModel.name) && item.tempModel.name.trim() !== item.model.name.trim()) {
                    item.error = $translate.instant('error_invalid_filename');
                    return false;
                }
                item.set_properties(function () {
                    $scope.fileNavigator.refresh();
                    $('#properties').modal('hide');
                });
            };


            $scope.createFolder = function (item) {
                var name = item.tempModel.name && item.tempModel.name.trim();
                item.tempModel.type = 'dir';
                item.tempModel.path = $scope.fileNavigator.currentPath;
                item.tempModel.root_id = $scope.fileNavigator.root_id;
                item.tempModel.folder_id = $scope.fileNavigator.getCurrentFolder();

                if (name && !$scope.fileNavigator.fileNameExists(name)) {
                    item.createFolder(function () {
                        $scope.fileNavigator.refresh();
                        $('#newfolder').modal('hide');
                    });
                } else {
                    $scope.temp.error = $translate.instant('error_invalid_filename');
                    return false;
                }
            };

            $scope.take_action = function (item, actionname) {
                $scope.modal = '';
                if ($scope.file_manager_on_action[actionname] !== '' && actionname === 'download') {
                    try {
                        eval('item' + '.' + actionname + '();');//$scope.file_manager_on_action[actionname] + '(item);');
                    }
                    catch (e) {
                        console.error('Error item.action() execution action=', actionname, e);
                    }
                } else if ($scope.file_manager_on_action[actionname] !== '' && actionname === 'choose') {
                    try {
                        eval($scope.file_manager_on_action[actionname] + '(item.model);');
                    }
                    catch (e) {
                        console.error('Error on filemanager caller side at action=', actionname, e);
                    }
                } else if ($scope.file_manager_on_action[actionname] !== '') {
                    eval('$scope.' + actionname.toString() + '(item)');//$scope.file_manager_on_action[actionname] + '(item);');
                }
            };

            $scope.auto_remove = function(name, folder,success, error){
                var data = {
                    'name':name,
                    'folder_id':folder
                };
                return $http.post(fileManagerConfig.auto_removeUrl, data).success(function(data) {
                    }).error(function(data) {
                        console.log('auto_remove_error')
                    })['finally'](function() {
                        self.inprocess = false;
                    });
            };

            $scope.can_action = function (item, actionname, defaultpermited) {
                if (actionname === 'paste') {
                    if (defaultpermited === true) {
                        return ($scope.copied_files.length > 0)
                    }
                }
                return defaultpermited
            };

            $scope.hideModal = function(){
                console.log('hide')
                $('#uploadfile').find('.modal').css("width", 5);
            };

            $scope.abort = function(){
                if($scope.uploadFileList.length>0){
                    if($scope.f){
                        $scope.f.upload.abort();
                        $scope.f.progress = 0;
                    }
                    $('#uploadfile').find('input[type=file], input[type=password], input[type=number], input[type=email], textarea').val('');
                }
            };

            $scope.uploading = function(list){
                if(list.length>0){
                    $timeout(function () {
                            $scope.upl = true
                    }, 1000);
                }else{
                    $scope.upl = false
                }
                return $scope.upl
            };

            $scope.uploadUsingUpload = function () {
                var file = $scope.uploadFileList[0];
                $scope.f = file;
                var url = '/filemanager/send/' + $scope.fileNavigator.getCurrentFolder() + '/';
                file.upload = Upload.upload({
                    url: url,
                    data: $scope.name,
                    resumeSizeUrl: '/filemanager/resumeupload/',
                    resumeChunkSize: $scope.config['chunkSize'],
                    ftype: $scope.f.type,
                    upload_file_id: $scope.upload_file_id,
                    headers: {
                        'optional-header': 'header-value'
                    },
                    fields: {username: $scope.username},
                    file: file
                });
                file.upload.progress(function (evt) {
                    file.progress = Math.min(100, parseInt(100.0 *
                        evt.loaded / evt.total));
                }).success(function (data) {
                    $scope.f.progress = 0;
                    $scope.fileNavigator.refresh();
                    $('#uploadfile').find('input[type=file]').val('');
                    $('#uploadfile').modal('hide');

                }).error(function (data) {
                    var errorMsg =  $translate.instant('error_uploading_files');
                    $scope.auto_remove($scope.f.name, $scope.fileNavigator.getCurrentFolder());
                    $scope.temp.error = errorMsg;
                    $timeout(function () {
                        $scope.temp.error = ''
                    }, 2000);

                });

            };

            $scope.getQueryParam = function (param) {
                var found;
                window.location.search.substr(1).split("&").forEach(function (item) {
                    if (param === item.split("=")[0]) {
                        found = item.split("=")[1];
                        return false;
                    }
                });
                return found;
            };

            $scope.isDisable = function (actionname, len, type) {
                var style;
                if (actionname === 'paste' && ($scope.copy_file_id != '' || $scope.cut_file_id != '') && type === 'parent') {
                    style = ''
                } else if (($scope.copy_file_id == '' && $scope.cut_file_id == '') && len < 2) {
                    style = 'cursor: default;pointer-events: none;color: gainsboro;'
                } else if ((actionname !== 'paste' && ($scope.copy_file_id != '' || $scope.cut_file_id != '')) && len < 2 || type === 'parent') {
                    style = 'cursor: default;pointer-events: none;color: gainsboro;'
                } else if (actionname === 'paste' && ($scope.copy_file_id == '' && $scope.cut_file_id == '')) {
                    style = 'cursor: default;pointer-events: none;color: gainsboro;'
                } else {
                    style = ''
                }
                if($scope.file_manager_default_action === actionname && (type !== 'parent' && type !== 'dir')){
                    style += 'font-weight: bold;color:black'
                }
                if(actionname === 'choose' && type !== 'img'){
                    style = 'cursor: default;pointer-events: none;color: gainsboro;'
                }
                return style
            };

            $scope.isModal = function (actionname) {
                if (actionname === 'rename' || actionname === 'remove' || actionname === 'properties') {
                    return true
                }
            };

            $scope.glyph = function (actionname) {
                if (actionname == 'rename') {
                    return 'edit'
                } else if (actionname == 'cut') {
                    return 'scissors'
                } else if (actionname == 'properties') {
                    return 'wrench'
                }else if(actionname == 'choose'){
                    return 'hand-up'
                } else {
                    return actionname
                }
            };

            $scope.err = function () {
                if ($scope.error == 'False' && $scope.rootdirs.length != 0) {
                    return false
                } else {
                    return true
                }
            };

            $scope.changeRoots = function () {
                if (error == 'False') {
                    $scope.changeRoot(_.keys($scope.rootdirs)[0], _.values($scope.rootdirs)[0]['name'])
                } else {
                    $scope.changeRoot('', '')
                }
            };

            $scope.errMsg = "You do not belong to any company!";
            $scope.changeRoots();//(_.keys($scope.rootdirs)[0], _.values($scope.rootdirs)[0]['name']);
            $scope.isWindows = $scope.getQueryParam('server') === 'Windows';
            $scope.fileNavigator.refresh();

        }]);
})(window, angular, jQuery);

from flask import render_template, request
from .blueprints_declaration import tools_bp
from .request_wrapers import ok
from ..models.translate import TranslateTemplate





# @tools_bp.route('/translate/', methods=['POST'])
# @ok
# def translate(json):
#     translation = TranslateTemplate.getTranslate(request.json['template'], request.json['phrase'])
#     return {'phrase': translation}




@tools_bp.route('/save_translate/', methods=['POST'])
@ok
def save_translate(json):
    return TranslateTemplate.getTranslate(request.json['template'], request.json['phrase'], request.json['url'], request.json['allow_html'])


@tools_bp.route('/update_last_accessed/', methods=['POST'])
@ok
def update_last_accessed(json):
    return TranslateTemplate.update_last_accessed(json['template'], json['phrase'])

@tools_bp.route('/SSO/<string:local_cookie>/', methods=['GET'])
def SSO(local_cookie):
    return render_template('tools/sso.html', local_cookie=local_cookie, profi_cookie=request.cookies.get('beaker.session.id'))



@tools_bp.route('/change_allowed_html/', methods=['POST'])
@ok
def change_allowed_html(json):
    return TranslateTemplate.change_allowed_html(json['template'], json['phrase'], json['allow_html'])

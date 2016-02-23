from flask import render_template, request, session, redirect, url_for, g, flash
from .blueprints_declaration import general_bp
from flask.ext.login import login_required
from ..models.portal import Portal, UserPortalReader, ReaderUserPortalPlan
from ..models.company import Company
from ..models.pr_base import Search, PRBase
from profapp.controllers.errors import BadDataProvided
from utils.pr_email import email_send
from .request_wrapers import ok, tos_required
from utils.db_utils import db
from sqlalchemy.sql import expression, and_


@general_bp.route('help/')
def help():
    return render_template('help.html')


@general_bp.route('')
def index():
    return render_template('general/index.html')


@general_bp.route('portals_list/', methods=['GET'])
def portals_list():
    portals = [(id, name) for id, name in UserPortalReader.get_portals_for_user()]
    return render_template('general/portals_list.html', portals=portals)


@general_bp.route('portals_list/', methods=['POST'])
@ok
def portals_list_load(json):
    ret, page, page2 = Search().search(
        {'class': Portal, 'return_fields': 'default_dict'},
        page=json.get('page'), search_text=json.get('text'), pagination=True)
    return [PRBase.merge_dicts(p, {'subscribed': True if UserPortalReader.get(portal_id=p_id) else False})
            for p_id, p in ret.items()]


@general_bp.route('subscribe/')
def auth_before_subscribe_to_portal():
    portal_id = request.args.get('portal_id', None)
    session['portal_id'] = portal_id
    return redirect(url_for('auth.login_signup_endpoint', login_signup='login'))


@general_bp.route('send_email_create_portal/')
@login_required
def send_email_create_portal():
    return render_template('general/send_email_create_portal.html')


@general_bp.route('send_email', methods=['POST'])
def send_email():
    return email_send(**{name: str(val) for name, val in request.form.items()})

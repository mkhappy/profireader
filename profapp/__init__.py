import hashlib
import re
import json

from flask import Flask, g, request, current_app
from beaker.middleware import SessionMiddleware
from authomatic import Authomatic
from profapp.utils.redirect_url import url_page
from flask import url_for
from flask.ext.bootstrap import Bootstrap
from flask.ext.moment import Moment
from flask.ext.login import LoginManager, \
    current_user
from flask.ext.mail import Mail
from flask.ext.login import AnonymousUserMixin
from flask import globals
from flask.ext.babel import Babel
import jinja2
from jinja2 import Markup, escape

from profapp.controllers.errors import csrf
from .constants.SOCIAL_NETWORKS import INFO_ITEMS_NONE, SOC_NET_FIELDS
from .constants.USER_REGISTERED import REGISTERED_WITH
from .models.users import User
from .models.config import Config
from profapp.controllers.errors import BadDataProvided
from .models.translate import TranslateTemplate
from .models.tools import HtmlHelper
from .models.pr_base import MLStripper
import os.path

from flask.sessions import SessionInterface
from beaker.middleware import SessionMiddleware


def req(name, allowed=None, default=None, exception=True):
    ret = request.args.get(name)
    if allowed and (ret in allowed):
        return ret
    elif default is not None:
        return default
    elif exception:
        raise Exception("value `{}` is not among allowed `{}`".format(name, allowed))
    else:
        return None


def filter_json(json, *args, NoneTo='', ExceptionOnNotPresent=False, prefix=''):
    ret = {}
    req_columns = {}
    req_relationships = {}

    for arguments in args:
        for argument in re.compile('\s*,\s*').split(arguments):
            columnsdevided = argument.split('.')
            column_names = columnsdevided.pop(0)
            for column_name in column_names.split('|'):
                if len(columnsdevided) == 0:
                    req_columns[column_name] = NoneTo if (column_name not in json or json[column_name] is None) else \
                        json[column_name]
                else:
                    if column_name not in req_relationships:
                        req_relationships[column_name] = []
                    req_relationships[column_name].append(
                        '.'.join(columnsdevided))

    for col in json:
        if col in req_columns or '*' in req_columns:
            ret[col] = NoneTo if (col not in json or json[col] is None) else json[col]
            if col in req_columns:
                del req_columns[col]
    if '*' in req_columns:
        del req_columns['*']

    if len(req_columns) > 0:
        columns_not_in_relations = list(set(req_columns.keys()) - set(json.keys()))
        if len(columns_not_in_relations) > 0:
            if ExceptionOnNotPresent:
                raise ValueError(
                    "you requested not existing json value(s) `%s%s`" % (
                        prefix, '`, `'.join(columns_not_in_relations),))
            else:
                for notpresent in columns_not_in_relations:
                    ret[notpresent] = NoneTo

        else:
            raise ValueError("you requested for attribute(s) but "
                             "relationships found `%s%s`" % (
                                 prefix, '`, `'.join(set(json.keys()).
                                     intersection(
                                     req_columns.keys())),))

    for relationname, relation in json.items():
        if relationname in req_relationships or '*' in req_relationships:
            if relationname in req_relationships:
                nextlevelargs = req_relationships[relationname]
                del req_relationships[relationname]
            else:
                nextlevelargs = req_relationships['*']
            if type(relation) is list:
                ret[relationname] = [
                    filter_json(child, *nextlevelargs,
                                prefix=prefix + relationname + '.'
                                ) for child in
                    relation]
            else:
                ret[relationname] = None if relation is None else filter_json(relation, *nextlevelargs,
                                                                              prefix=prefix + relationname + '.')

    if '*' in req_relationships:
        del req_relationships['*']

    if len(req_relationships) > 0:
        relations_not_in_columns = list(set(
            req_relationships.keys()) - set(json))
        if len(relations_not_in_columns) > 0:
            raise ValueError(
                "you requested not existing json(s) `%s%s`" % (
                    prefix, '`, `'.join(relations_not_in_columns),))
        else:
            raise ValueError("you requested for json deeper than json is(s) but "
                             "column(s) found `%s%s`" % (
                                 prefix, '`, `'.join(set(json).intersection(
                                     req_relationships)),))

    return ret


def db_session_func(db_config):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import scoped_session, sessionmaker

    engine = create_engine(db_config, echo=False)
    g.sql_connection = engine.connect()
    db_session = scoped_session(sessionmaker(autocommit=False,
                                             autoflush=False,
                                             bind=engine))
    return db_session


def load_database(db_config):
    def load_db():
        db_session = db_session_func(db_config)
        g.db = db_session
        g.req = req
        g.filter_json = filter_json
        g.get_url_adapter = get_url_adapter
        g.fileUrl = fileUrl

    return load_db


def close_database(exception):
    db = getattr(g, 'db', None)
    sql_connection = getattr(g, 'sql_connection', None)
    if sql_connection:
        sql_connection.close()
    if db is not None:
        if exception:
            db.rollback()
        else:
            db.commit()
            db.close()


def setup_authomatic(app):
    authomatic = Authomatic(app.config['OAUTH_CONFIG'],
                            app.config['SECRET_KEY'],
                            report_errors=True)

    def func():
        g.authomatic = authomatic

    return func


def load_user(apptype):
    user_init = current_user
    user = None

    user_dict = INFO_ITEMS_NONE.copy()
    user_dict['logged_via'] = None
    user_dict['registered_tm'] = None
    user_dict['lang'] = 'uk'
    #  ['id', 'email', 'first_name', 'last_name', 'name', 'gender', 'link', 'phone']

    if user_init.is_authenticated():
        from profapp.models.users import User

        id = user_init.get_id()
        # user = g.db.query(User).filter_by(id=id).first()
        user = current_user
        logged_via = REGISTERED_WITH[user.logged_in_via()]
        user_dict['logged_via'] = logged_via

        user_dict['profile_completed'] = user.profile_completed()

        for attr in SOC_NET_FIELDS:
            if attr == 'link' or attr == 'phone':
                user_dict[attr] = \
                    str(user.attribute_getter(logged_via, attr))
            else:
                user_dict[attr] = \
                    user.attribute_getter(logged_via, attr)
        user_dict['id'] = id
        user_dict['registered_tm'] = user.registered_tm
        user_dict['lang'] = user.lang
        user_dict['tos'] = user.tos
        # name = user.user_name


    # user_dict = {'id': id, 'name': name, 'logged_via': logged_via}

    g.user_init = user_init
    g.user = user
    g.user_dict = user_dict
    g.user_id = user_dict['id']

    for variable in g.db.query(Config).filter_by(server_side=1).all():

        var_id = variable.id
        if variable.type == 'int':
            current_app.config[var_id] = int(variable.value)
        elif variable.type == 'bool':
            current_app.config[var_id] = False if int(variable.value) == 0 else True
        else:
            current_app.config[var_id] = '%s' % (variable.value,)


# def load_user():
#    g.user = None
#    if 'user_id' in session.keys():
#        g.user = g.db.query(User).\
#            query.filter_by(id=session['user_id']).first()


def load_portal_id(app):
    from profapp.models.portal import Portal

    def func():

        portal = g.db.query(Portal).filter_by(host=request.host).first()

        g.portal_id = portal.id if portal else None

        if portal:
            g.lang = portal.lang
        else:
            g.lang = g.user_dict['lang']


            # g.portal_id = db_session_func(app.config['SQLALCHEMY_DATABASE_URI']).\
            #             query(Portal.id).filter_by(host=app.config['SERVER_NAME']).one()[0]

    return func


# def flask_endpoint_to_angular(endpoint, **kwargs):
#     options = {}
#     for kw in kwargs:
#         options[kw] = "{{" + "{0}".format(kwargs[kw]) + "}}"
#     url = url_for(endpoint, **options)
#     import urllib.parse
#
#     url = urllib.parse.unquote(url)
#     url = url.replace('{{', '{{ ').replace('}}', ' }}')
#     return url


def fileUrl(id, down=False, if_no_file=None):
    if not id:
        return if_no_file if if_no_file else ''

    server = re.sub(r'^[^-]*-[^-]*-4([^-]*)-.*$', r'\1', id)
    return '//file' + server + '.profireader.com/' + id + '/' + ('?d' if down else '')


def prImage(id, if_no_image=None):
    file = fileUrl(id, False, if_no_image if if_no_image else "//static.profireader.com/static/images/no_image.png")
    return Markup(
        ' src="//static.profireader.com/static/images/0.gif" style="background-position: center; background-size: contain; background-repeat: no-repeat; background-image: url(\'%s\')" ' % (
            file,))


def translates(template):
    phrases = g.db.query(TranslateTemplate).filter_by(template=template).all()
    ret = {}
    for ph in phrases:
        tim = ph.ac_tm.timestamp() if ph.ac_tm else ''
        html_or_text = getattr(ph, g.lang)
        html_or_text = MLStripper().strip_tags(html_or_text) if ph.allow_html == '' else html_or_text
        ret[ph.name] = {'lang': html_or_text, 'time': tim, 'allow_html': ph.allow_html}

    return json.dumps(ret)


def translate_phrase_or_html(context, phrase, dictionary=None, allow_html=''):
    template = context.name
    translated = TranslateTemplate.getTranslate(template, phrase, None, allow_html)
    r = re.compile("%\\(([^)]*)\\)s")

    def getFromContext(context, indexes, default):
        d = context
        for i in indexes:
            if i in d:
                d = d[i]
            else:
                return default
        return d

    def replaceinphrase(match):
        indexes = match.group(1).split('.')
        return str(getFromContext(context if dictionary is None else dictionary, indexes, match.group(1)))

    return r.sub(replaceinphrase, translated)


@jinja2.contextfunction
def translate_phrase(context, phrase, dictionary=None):
    return MLStripper().strip_tags(translate_phrase_or_html(context, phrase, dictionary, ''))


@jinja2.contextfunction
def translate_html(context, phrase, dictionary=None):
    return Markup(translate_phrase_or_html(context, phrase, dictionary, '*'))


@jinja2.contextfunction
def pr_help_tooltip(context, phrase, placement='bottom', trigger='mouseenter',
                    classes='glyphicon glyphicon-question-sign'):
    return Markup(
        '<span popover-placement="' + placement + '" popover-trigger="' + trigger + '" class="' + classes +
        '" uib-popover-html="\'' + HtmlHelper.quoteattr(
            translate_phrase_or_html(context, 'help tooltip ' + phrase, None, '*')) + '\'"></span>')


@jinja2.contextfunction
def nl2br(value):
    _paragraph_re = re.compile(r'(?:\r\n|\r|\n){2,}')
    result = u'\n\n'.join(u'<p>%s</p>' % p.replace('\n', Markup('<br>\n'))
                          for p in _paragraph_re.split(escape(value)))
    result = Markup(result)
    return result


def config_variables():
    variables = g.db.query(Config).filter_by(client_side=1).all()
    ret = {}

    for variable in variables:
        var_id = variable.id
        if variable.type == 'int':
            ret[var_id] = '%s' % (int(variable.value))
        elif variable.type == 'bool':
            ret[var_id] = 'false' if int(variable.value) == 0 else 'true'
        elif variable.type == 'float':
             ret[var_id] = '%s' % (float(variable.value))
        elif variable.type == 'timestamp':
            ret[var_id] = 'new Date(%s)' % (int(variable.value))
        else:
            ret[var_id] = '\'' + variable.value + '\''
    return "<script>\nConfig = {};\n" + ''.join(
        [("Config['%s']=%s;\n" % (var_id, ret[var_id])) for var_id in ret]) + '</script>'


def config_variables():
    variables = g.db.query(Config).filter_by(server_side=1).all()
    ret = {}
    for variable in variables:
        var_id = variable.id
        if variable.type == 'int':
            ret[var_id] = '%s' % (int(variable.value),)
        elif variable.type == 'bool':
            ret[var_id] = 'false' if int(variable.value) == 0 else 'true'
        elif variable.type == 'float':
             ret[var_id] = '%s' % (float(variable.value))
        elif variable.type == 'timestamp':
            ret[var_id] = 'new Date(%s)' % (int(variable.value))
        else:
            ret[var_id] = '\'' + variable.value.replace('\\','\\\\').replace('\n','\\n').replace('\'','\\\'') + '\''


    return "<script>\nConfig = {};\n" + ''.join(
        [("Config['%s']=%s;\n" % (var_id, ret[var_id])) for var_id in ret]) + '</script>'


def get_url_adapter():
    appctx = globals._app_ctx_stack.top
    reqctx = globals._request_ctx_stack.top
    if reqctx is not None:
        url_adapter = reqctx.url_adapter
    else:
        url_adapter = appctx.url_adapter
    return url_adapter


# TODO: OZ by OZ: add kwargs just like in url_for
def raw_url_for(endpoint):
    url_adapter = get_url_adapter()

    rules = url_adapter.map._rules_by_endpoint.get(endpoint, ())

    if len(rules) < 1:
        raise Exception('You requsted url for endpoint `%s` but no endpoint found' % (endpoint,))

    rules_simplified = [re.compile('<[^:]*:').sub('<', rule.rule) for rule in rules]

    return "function (dict) { return find_and_build_url_for_endpoint(dict, %s); }" % (json.dumps(rules_simplified))
    # \
    #        " { var ret = '" + ret + "'; " \
    #                                                " for (prop in dict) ret = ret.replace('<'+prop+'>',dict[prop]); return ret; }"


def pre(value):
    res = []
    for k in dir(value):
        res.append('%r %r\n' % (k, getattr(value, k)))
    return '<pre>' + '\n'.join(res) + '</pre>'


mail = Mail()
moment = Moment()
bootstrap = Bootstrap()

login_manager = LoginManager()
login_manager.session_protection = 'strong'
#  The login_view attribute sets the endpoint for the login page.
#  I am not sure that it is necessary
login_manager.login_view = 'auth.login_signup_endpoint'


class AnonymousUser(AnonymousUserMixin):
    id = 0
    # def gravatar(self, size=100, default='identicon', rating='g'):
    # if request.is_secure:
    #    url = 'https://secure.gravatar.com/avatar'
    # else:
    #    url = 'http://www.gravatar.com/avatar'
    # hash = hashlib.md5(
    #    'guest@profireader.com'.encode('utf-8')).hexdigest()
    # return '{url}/{hash}?s={size}&d={default}&r={rating}'.format(
    #    url=url, hash=hash, size=size, default=default, rating=rating)
    # return '//static.profireader.com/static/no_avatar.png'

    @staticmethod
    def check_rights(permissions):
        return False

    @staticmethod
    def is_administrator():
        return False

    @staticmethod
    def is_banned():
        return False

    def get_id(self):
        return self.id

    @staticmethod
    @property
    def user_name():
        return 'Guest'

    def avatar(self, size=100):
        avatar = self.gravatar(size=size)
        return avatar

    def gravatar(self, size=100, default='identicon', rating='g'):
        if request.is_secure:
            url = 'https://secure.gravatar.com/avatar'
        else:
            url = 'http://www.gravatar.com/avatar'

        email = getattr(self, 'profireader_email', 'guest@profireader.com')

        # email = 'guest@profireader.com'
        # if self.profireader_email:
        #     email = self.profireader_email

        hash = hashlib.md5(
            email.encode('utf-8')).hexdigest()
        return '{url}/{hash}?s={size}&d={default}&r={rating}'.format(
            url=url, hash=hash, size=size, default=default, rating=rating)

    def __repr__(self):
        return "<User(id = %r)>" % self.id






login_manager.anonymous_user = AnonymousUser


def create_app(config='config.ProductionDevelopmentConfig', apptype='profi'):
    app = Flask(__name__, static_folder = './static')

    app.config.from_object(config)
    # app.config['SERVER_NAME'] = host

    babel = Babel(app)

    app.teardown_request(close_database)
    app.before_request(load_database(app.config['SQLALCHEMY_DATABASE_URI']))
    app.config['DEBUG'] = True

    app.before_request(lambda: load_user(apptype))
    app.before_request(setup_authomatic(app))
    app.before_request(load_portal_id(app))


    def add_map_headers_to_less_files(response):

        response.headers.add('Access-Control-Allow-Origin', '*')

        if (request.path and re.search(r'\.css$', request.path)):
            mapfile = re.sub(r'\.css$', r'.css.map', request.path)
            if os.path.isfile(os.path.realpath(os.path.dirname(__file__)) + mapfile):
                response.headers.add('X-Sourcemap', mapfile)
                # :/packages/ian_accounts-ui-bootstrap-3/a3d4ce536f173c44d48a89e9da63d0f75025b4ec.map

        return response


    app.after_request(add_map_headers_to_less_files)

    if apptype == 'front':
        from profapp.controllers.blueprints_register import register_front as register_blueprints_front
        register_blueprints_front(app)
        my_loader = jinja2.ChoiceLoader([
            app.jinja_loader,
            jinja2.FileSystemLoader('templates_front'),
        ])
        app.jinja_loader = my_loader
    elif apptype == 'static':
        from profapp.controllers.blueprints_register import register_static as register_blueprints_static
        register_blueprints_static(app)
    elif apptype == 'file':
        from profapp.controllers.blueprints_register import register_file as register_blueprints_file
        register_blueprints_file(app)
    else:
        from profapp.controllers.blueprints_register import register_profi as register_blueprints_profi
        register_blueprints_profi(app)

    bootstrap.init_app(app)
    mail.init_app(app)
    moment.init_app(app)
    login_manager.init_app(app)
    login_manager.session_protection = 'basic'

    # if not app.debug and not app.testing and not app.config['SSL_DISABLE']:
    #    from flask.ext.sslify import SSLify
    #    sslify = SSLify(app)

    @login_manager.user_loader
    def load_user_manager(user_id):
        return g.db.query(User).get(user_id)

    csrf.init_app(app)

    # read this: http://stackoverflow.com/questions/6036082/call-a-python-function-from-jinja2
    # app.jinja_env.globals.update(flask_endpoint_to_angular=flask_endpoint_to_angular)
    app.jinja_env.globals.update(raw_url_for=raw_url_for)
    app.jinja_env.globals.update(pre=pre)
    app.jinja_env.globals.update(translates=translates)
    app.jinja_env.globals.update(fileUrl=fileUrl)
    app.jinja_env.globals.update(prImage=prImage)
    app.jinja_env.globals.update(url_page=url_page)
    app.jinja_env.globals.update(config_variables=config_variables)
    app.jinja_env.globals.update(_=translate_phrase)
    app.jinja_env.globals.update(__=translate_html)
    app.jinja_env.globals.update(tinymce_format_groups=HtmlHelper.tinymce_format_groups)
    app.jinja_env.globals.update(pr_help_tooltip=pr_help_tooltip)

    app.jinja_env.filters['nl2br'] = nl2br


    # see: http://flask.pocoo.org/docs/0.10/patterns/sqlalchemy/
    # Flask will automatically remove database sessions at the end of the
    # request or when the application shuts down:
    # from db_init import db_session

    # @app.teardown_appcontext
    # def shutdown_session(exception=None):
    #     try:
    #         db_session.commit()
    #     except Exception:
    #         session.rollback()
    #         raise
    #     finally:
    #         session.close()  # optional, depends on use case
    #     # db_session.remove()

    session_opts = {
        'session.type': 'ext:memcached',
        'session.url': 'memcached.profi:11211'
    }

    class BeakerSessionInterface(SessionInterface):
        def open_session(self, app, request):
            _session = request.environ['beaker.session']
            return _session


        def save_session(self, app, session, response):
            session.save()

    app.wsgi_app = SessionMiddleware(app.wsgi_app, session_opts)
    app.session_interface = BeakerSessionInterface()

    return app

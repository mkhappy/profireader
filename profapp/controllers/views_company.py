from .blueprints_declaration import company_bp
from ..models.company import simple_permissions
from flask.ext.login import login_required, current_user
from flask import render_template, request, url_for, g, redirect
from ..models.company import Company, UserCompany, Right, RightHumnReadible
from ..models.users import User
from .request_wrapers import ok, check_rights
from ..constants.STATUS import STATUS
from flask.ext.login import login_required
from ..models.articles import Article
from ..models.portal import PortalDivision
from ..constants.ARTICLE_STATUSES import ARTICLE_STATUS_IN_COMPANY, ARTICLE_STATUS_IN_PORTAL
from ..models.portal import Portal, MemberCompanyPortal, UserPortalReader
from ..models.articles import ArticleCompany, ArticlePortalDivision
from utils.db_utils import db
from ..constants.FILES_FOLDERS import FOLDER_AND_FILE
from collections import OrderedDict
from ..models.tag import TagPortalDivisionArticle
# from ..models.rights import list_of_RightAtomic_attributes
from profapp.models.rights import RIGHTS
from ..models.files import File, ImageCroped
from flask import session
from .pagination import pagination
from .views_file import crop_image
from config import Config
from ..models.pr_base import Search


@company_bp.route('/search_to_submit_article/', methods=['POST'])
@login_required
# @check_rights(simple_permissions(Right[RIGHTS.SUBMIT_PUBLICATIONS()]))
def search_to_submit_article(json):
    companies = Company().search_for_company(g.user_dict['id'], json['search'])
    return companies


@company_bp.route('/', methods=['GET'])
@login_required
# @check_rights(simple_permissions([]))
def show():
    return render_template('company/companies.html')


from sqlalchemy import and_


@company_bp.route('/', methods=['POST'])
@login_required
# @check_rights(simple_permissions([]))
@ok
def load_companies(json):
    user_companies = [user_comp for user_comp in current_user.employer_assoc]
    return {'companies': [usr_cmp.employer.get_client_side_dict() for usr_cmp in user_companies
                          if usr_cmp.status == STATUS.ACTIVE()],
            'non_active_user_company_status': [usr_cmp.employer.get_client_side_dict() for
                                               usr_cmp in user_companies if usr_cmp.status
                                               != STATUS.ACTIVE()],
            'user_id': g.user_dict['id']}


@company_bp.route('/materials/<string:company_id>/', methods=['GET'])
@login_required
# @check_rights(simple_permissions([]))
def materials(company_id):
    company = db(Company, id=company_id).one()
    company_logo = company.logo_file_relationship.url() \
        if company.logo_file_id else '/static/images/company_no_logo.png'
    return render_template(
        'company/materials.html',
        company=company,
        company_id=company_id,
        angular_ui_bootstrap_version='//angular-ui.github.io/bootstrap/ui-bootstrap-tpls-0.14.2.js',
        company_logo=company_logo
    )


@company_bp.route('/materials/<string:company_id>/', methods=['POST'])
@login_required
@ok
def materials_load(json, company_id):
    company = db(Company, id=company_id).one()
    company_logo = company.logo_file_relationship.url() \
        if company.logo_file_id else '/static/images/company_no_logo.png'
    page = json.get('gr_data')['paginationOptions']['pageNumber'] if json.get('gr_data') else 1
    pageSize = json.get('gr_data')['paginationOptions']['pageSize'] if json.get('gr_data') else 25
    search_text = json.get('gr_data')['search_text'] if json.get('gr_data') else None
    params = {}
    if json.get('gr_data'):
        params['sort'] = {}
        params['filter'] = {}
        if json.get('gr_data')['sort']:
            for n in json.get('gr_data')['sort']:
                params['sort'][n] = json.get('gr_data')['sort'][n]
        if json.get('gr_data')['filter']:
            for b in json.get('gr_data')['filter']:
                if json.get('gr_data')['filter'][b] != '-- all --':
                    params['filter'][b] = json.get('gr_data')['filter'][b]
    # if json.get('grid_data')['new_status']:
    #     ArticleCompany.update_article(
    #         company_id=company_id,
    #         article_id=json.get('article_id'),
    #         **{'status': json.get('grid_data')['new_status']})
    subquery = ArticleCompany.subquery_company_articles(search_text=search_text,
                                                        company_id=company_id,
                                                        **params)
    articles, pages, current_page = pagination(subquery, page=page, items_per_page=pageSize)

    add_param = {'value': '1', 'label': '-- all --'}
    statuses_g = Article.list_for_grid_tables(ARTICLE_STATUS_IN_COMPANY.all, add_param, False)
    portals_g = Article.list_for_grid_tables(ArticlePortalDivision.get_portals_where_company_send_article(company_id),
                                             add_param, True)
    gr_publ_st = Article.list_for_grid_tables(ARTICLE_STATUS_IN_PORTAL.all, add_param, False)
    grid_data = Article.getListGridDataMaterials(articles)
    grid_filters = {'portals': portals_g,'material_status': statuses_g, 'publication_status': gr_publ_st}
    return {'grid_data': grid_data,
            'grid_filters': grid_filters,
            'total': subquery.count()
            }


@company_bp.route('/material_details/<string:company_id>/<string:article_id>/', methods=['GET'])
@login_required
# @check_rights(simple_permissions([]))
def material_details(company_id, article_id):
    company = db(Company, id=company_id).one()
    company_logo = company.logo_file_relationship.url() \
        if company.logo_file_id else '/static/images/company_no_logo.png'
    return render_template('company/material_details.html',
                           company_id=company_id,
                           article_id=article_id,
                           company_logo=company_logo,
                           company_name=company.name,
                           company=company)


# TODO: VK by OZ: remove company_* kwargs



@company_bp.route('/material_details/<string:company_id>/<string:article_id>/', methods=['POST'])
@login_required
@ok
# @check_rights(simple_permissions([]))
def load_material_details(json, company_id, article_id):
    article = Article.get_one_article(article_id)
    portals = {port.portal_id: port.portal.get_client_side_dict() for port in
               MemberCompanyPortal.get_portals(company_id)}

    joined_portals = {}
    if article.portal_article:
        joined_portals = {articles.division.portal.id: portals.pop(articles.division.portal.id)
                          for articles in article.portal_article
                          if articles.division.portal.id in portals}

    article = article.get_client_side_dict(fields='id, title,short, cr_tm, md_tm, '
                                                  'company_id, status, long,'
                                                  'editor_user_id, company.name|id,'
                                                  'portal_article.id, portal_article.division.name, '
                                                  'portal_article.division.portal.name,'
                                                  'portal_article.status')

    user_rights = list(g.user.user_rights_in_company(company_id))

    company = db(Company, id=company_id).one()
    company_logo = company.logo_file_relationship.url() \
        if company.logo_file_id else '/static/images/company_no_logo.png'

    return {'article': article,
            'allowed_statuses': ARTICLE_STATUS_IN_COMPANY.can_user_change_status_to(article['status']),
            'portals': portals,
            'company': Company.get(company_id).get_client_side_dict(fields='id, employees.id|profireader_name'),
            'selected_portal': {},
            'selected_division': {},
            # 'user_rights': ['publish', 'unpublish', 'edit'],
            # TODO: uncomment the string below and delete above
            # TODO: when all works with rights are finished
            'user_rights': user_rights,
            'send_to_user': {},
            'joined_portals': joined_portals,
            'company_logo': company_logo}


@company_bp.route('/<string:article_portal_division_id>/', methods=['POST'])
@login_required
@ok
# @check_rights(simple_permissions([]))
def delete_atricle_from_portal(json, article_portal_division_id):
    g.sql_connection.execute("DELETE FROM article_portal_division WHERE id='%s';"
                             % article_portal_division_id)
    new_json = json.copy()
    for article in json:
        if json[article]['id'] == article_portal_division_id:
            del new_json[article]
    return new_json


@company_bp.route('/get_tags/<string:portal_division_id>', methods=['POST'])
@login_required
# @check_rights(simple_permissions([]))
@ok
def get_tags(json, portal_division_id):
    available_tags = g.db.query(PortalDivision).get(portal_division_id).portal_division_tags
    available_tag_names = list(map(lambda x: getattr(x, 'name'), available_tags))
    return {'availableTags': available_tag_names}


@company_bp.route('/update_material_status/<string:company_id>/<string:article_id>',
                  methods=['POST'])
# @login_required
# @check_rights(simple_permissions([]))
@ok
def update_material_status(json, company_id, article_id):
    allowed_statuses = ARTICLE_STATUS_IN_COMPANY.can_user_change_status_to(json['new_status'])

    ArticleCompany.update_article(
        company_id=company_id,
        article_id=article_id,
        **{'status': json['new_status']})

    return {'article_new_status': json['new_status'],
            'allowed_statuses': allowed_statuses,
            'status': 'ok'}


@company_bp.route('/profile/<string:company_id>/')
@login_required
# @check_rights(simple_permissions(['manage_rights_company']))
def profile(company_id):
    company = db(Company, id=company_id).one()
    user_rights = list(g.user.user_rights_in_company(company_id))
    # company_logo = File.get(company.logo_file).url() \
    #     if company.logo_file else '/static/images/company_no_logo.png'
    company_logo = company.logo_file_relationship.url() \
        if company.logo_file_id else '/static/images/company_no_logo.png'
    return render_template('company/company_profile.html',
                           company=company,
                           user_rights=user_rights,
                           company_logo=company_logo,
                           company_id=company_id,
                           company_name=company.name
                           )


@company_bp.route('/employees/<string:company_id>/')
@login_required
# @check_rights(simple_permissions([]))
def employees(company_id):
    company_user_rights = UserCompany.show_rights(company_id)
    ordered_rights = sorted(Right.keys(), key=lambda t: Right.RIGHT_POSITION()[t.lower()])
    ordered_rights = list(map((lambda x: getattr(x, 'lower')()), ordered_rights))

    for user_id in company_user_rights.keys():
        rights = company_user_rights[user_id]['rights']
        rez = OrderedDict()
        for elem in ordered_rights:
            rez[elem] = True if elem in rights else False
        company_user_rights[user_id]['rights'] = rez

    user_id = current_user.get_id()
    curr_user = {user_id: company_user_rights[user_id]}
    current_company = db(Company, id=company_id).one()

    company_logo = current_company.logo_file_relationship.url() \
        if current_company.logo_file_id else '/static/images/company_no_logo.png'

    return render_template('company/company_employees.html',
                           company=current_company,
                           company_id=company_id,
                           company_user_rights=company_user_rights,
                           curr_user=curr_user,
                           Right=Right,
                           RightHumnReadible=RightHumnReadible,
                           company_logo=company_logo,
                           company_name=current_company.name
                           )


@company_bp.route('/update_rights', methods=['POST'])
@login_required
# @check_rights(simple_permissions([RIGHTS.MANAGE_RIGHTS_COMPANY()]))
def update_rights():
    data = request.form
    company_id, user_id, position = (data.get('company_id'), data.get('user_id'), data['position'])
    if not db(Company, id=company_id, author_user_id=user_id).count():
        UserCompany.update_rights(user_id=data['user_id'],
                                  company_id=data['company_id'],
                                  new_rights=data.getlist('right'),
                                  position=data['position'])
    else:
        db(UserCompany, company_id=company_id, user_id=user_id).update(dict(position=position))
    return redirect(url_for('company.employees',
                            company_id=data['company_id']))


@company_bp.route('/create/', methods=['GET'])
@company_bp.route('/edit/<string:company_id>/', methods=['GET'])
@login_required
# @check_rights(simple_permissions([]))
def update(company_id=None):
    company = db(Company, id=company_id).first()
    return render_template('company/company_edit.html', company_id=company_id,
                           company_name=company.name if company else '',
                           company=company if company else {})


# TODO: VK by OZ: remove company_* kwargs

@company_bp.route('/create/', methods=['POST'])
@company_bp.route('/edit/<string:company_id>/', methods=['POST'])
@login_required
@ok
def load(json, company_id=None):
    action = g.req('action', allowed=['load', 'validate', 'save'])
    company = Company() if company_id is None else Company.get(company_id)
    if action == 'load':
        company_dict = company.get_client_side_dict()
        image_dict = {'ratio': Config.IMAGE_EDITOR_RATIO, 'coordinates': None,
                      'image_file_id': company_dict.get('logo_file_id'),
                      'no_image_url': g.fileUrl(FOLDER_AND_FILE.no_logo())
                      }
        try:
            if company_dict.get('logo_file_id'):
                image_dict['image_file_id'], image_dict['coordinates'] = ImageCroped. \
                    get_coordinates_and_original_img(company_dict.get('logo_file_id'))
            else:
                image_dict['image_file_id'] = None
        except Exception as e:
            pass
        image = {'image': image_dict}
        company_dict.update(image)
        return company_dict
    else:
        company.attr(g.filter_json(json, 'about', 'address', 'country', 'email', 'name', 'phone',
                                   'phone2', 'region', 'short_description', 'lon', 'lat'))

        if action == 'validate':
            if company_id is not None:
                company.detach()
            return company.validate(company_id is None)
        else:
            img = json['image']
            img_id = img.get('image_file_id')
            if img_id:
                company.logo_file_id = crop_image(img_id, img['coordinates'])
            elif not img_id:
                company.logo_file_id = None

            if company_id is None:
                company.setup_new_company()
            return company.save().get_client_side_dict()


# @company_bp.route('/confirm_create/', methods=['POST'])
# @login_required
# # @check_rights(simple_permissions([]))
# @ok
# def confirm_create(json):


# @company_bp.route('/edit/<string:company_id>/', methods=['POST'])
# @login_required
# @ok
# # @check_rights(simple_permissions([RIGHTS.MANAGE_RIGHTS_COMPANY()]))
# def edit_load(json, company_id):
#     company = db(Company, id=company_id).one()
#     return company.get_client_side_dict()


# @company_bp.route('/confirm_edit/<string:company_id>', methods=['POST'])
# @login_required
# @ok
# # @check_rights(simple_permissions([RIGHTS.MANAGE_RIGHTS_COMPANY()]))
# def confirm_edit(json, company_id):
#
#     return {}


@company_bp.route('/subscribe/<string:company_id>/')
@login_required
# @check_rights(simple_permissions([]))
def subscribe(company_id):
    company_role = UserCompany(user_id=g.user_dict['id'],
                               company_id=company_id,
                               status=STATUS.NONACTIVE())
    company_role.subscribe_to_company().save()

    return redirect(url_for('company.profile', company_id=company_id))


@company_bp.route('/search_for_company_to_join/', methods=['POST'])
@login_required
@ok
# @check_rights(simple_permissions([]))
def search_for_company_to_join(json):
    companies = Company().search_for_company_to_join(g.user_dict['id'], json['search'])
    return companies


@company_bp.route('/search_for_user/<string:company_id>', methods=['POST'])
@login_required
@ok
# @check_rights(simple_permissions([]))
def search_for_user(json, company_id):
    users = UserCompany().search_for_user_to_join(company_id, json['search'])
    return users


@company_bp.route('/send_article_to_user/', methods=['POST'])
@login_required
@ok
# @check_rights(simple_permissions([]))
def send_article_to_user(json):
    return {'user': json['send_to_user']}


@company_bp.route('/join_to_company/<string:company_id>/', methods=['POST'])
@login_required
@ok
# @check_rights(simple_permissions([]))
def join_to_company(json, company_id):
    company_role = UserCompany(user_id=g.user_dict['id'],
                               company_id=json['company_id'],
                               status=STATUS.NONACTIVE())
    company_role.subscribe_to_company().save()
    return {'companies': [employer.get_client_side_dict() for employer in current_user.employers]}


@company_bp.route('/add_subscriber/', methods=['POST'])
@login_required
# @check_rights(simple_permissions([RIGHTS.ADD_EMPLOYEE()]))
def confirm_subscriber():
    company_role = UserCompany()
    data = request.form
    company_role.apply_request(company_id=data['company_id'],
                               user_id=data['user_id'],
                               bool=data['req'])
    return redirect(url_for('company.profile', company_id=data['company_id']))


@company_bp.route('/suspend_employee/', methods=['POST'])
@login_required
# @check_rights(simple_permissions([RIGHTS.SUSPEND_EMPLOYEE()]))
def suspend_employee():
    data = request.form
    UserCompany.change_status_employee(user_id=data['user_id'],
                                       company_id=data['company_id'])
    return redirect(url_for('company.employees',
                            company_id=data['company_id']))


@company_bp.route('/fire_employee/', methods=['POST'])
@login_required
def fire_employee():
    data = request.form
    UserCompany.change_status_employee(company_id=data.get('company_id'),
                                       user_id=data.get('user_id'),
                                       status=STATUS.DELETED())
    return redirect(url_for('company.employees', company_id=data.get('company_id')))


@company_bp.route('/unsuspend/<string:user_id>,<string:company_id>')
@login_required
def unsuspend(user_id, company_id):
    UserCompany.change_status_employee(user_id=user_id,
                                       company_id=company_id,
                                       status=STATUS.ACTIVE())
    return redirect(url_for('company.employees', company_id=company_id))


@company_bp.route('/suspended_employees/<string:company_id>',
                  methods=['GET'])
@login_required
# @check_rights(simple_permissions([]))
def suspended_employees(company_id):
    company = db(Company, id=company_id).one()
    return render_template('company/company_fired.html', company_id=company_id, company=company)


@company_bp.route('/suspended_employees/<string:company_id>', methods=['POST'])
@login_required
# @check_rights(simple_permissions([]))
@ok
def load_suspended_employees(json, company_id):
    suspend_employees = Company.query_company(company_id)
    suspend_employees = suspend_employees.suspended_employees()
    return suspend_employees


@company_bp.route('/readers/<string:company_id>/', methods=['GET'])
@company_bp.route('/readers/<string:company_id>/<int:page>/', methods=['GET'])
@login_required
# @check_rights(simple_permissions([]))
def readers(company_id, page=1):
    company = Company.get(company_id)
    company_dict = company.get_client_side_dict('name')
    company_logo = company.logo_file_relationship.url() \
        if company.logo_file_id else '/static/images/company_no_logo.png'

    company_readers, pages, page = pagination(query=company.readers_query, page=page)

    reader_fields = ('id', 'email', 'nickname', 'first_name', 'last_name')
    company_readers_list_dict = list(map(lambda x: dict(zip(reader_fields, x)), company_readers))

    return render_template('company/company_readers.html',
                           company=company,
                           company_id=company_id,
                           company_logo=company_logo,
                           companyReaders=company_readers_list_dict,
                           pages=pages,
                           current_page=page,
                           page_buttons=Config.PAGINATION_BUTTONS,
                           search_text=None,
                           )

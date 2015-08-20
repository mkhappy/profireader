from flask import render_template, redirect, url_for, request, g
from profapp.forms.article import ArticleForm
from profapp.models.articles import Article, ArticleVersion
from profapp.models.users import User
from profapp.models.company import Company
from db_init import db_session
from .blueprints import article_bp
#import os


@article_bp.route('/', methods=['GET'])
def show_mine():
    return render_template('article/list.html', articles = Article.list())

@article_bp.route('/create', methods=['GET'])
def create_form():
    return render_template('article/edit_form.html', article={'name': '', 'short': '', 'full': ''})

@article_bp.route('/save', methods=['POST'])
def save():
    return ''

# @article_bp.route('/articles/update/<string:article_history_id>', methods=['GET'])
# def edit_form(article_history_id):
#     return render_template('article/edit_form.html', article = {'name': '', 'short': '', 'full': ''})
#
# @article_bp.route('/articles/create.json', methods=['POST'])
# def create_article():
#     return render_template('article/edit_form.html', articles=Article.query_all_articles('1'))
#
# @article_bp.route('/article/', methods=['GET', 'POST'])
# @article_bp.route('/article/<int:page>', methods=['GET', 'POST'])
# def article(page=1):

    # form = ArticleForm()
    # posts = ArticleHistory.query.filter(ArticleHistory.id == page)

    # if form.validate_on_submit():
    #     article_history = ArticleHistory(form.name.data, form.article.data, 0,
    #                                      User.query.first().id)
    #     db_session.add(article_history)
    #     db_session.commit()
    #
    #     if len(list(ArticleHistory.query.filter(article_history.name == ArticleHistory.name))) <= 1:
    #         article = Article(User.query.first().id,
    #         Company.query.first().id,
    #         article_history.id)
    #         db_session.add(article)
    #         db_session.commit()
    #     return redirect(url_for('article', page=article_history.id))
    # elif request.method != 'POST':
    #
    #     for post in posts:
    #         form.name.data = post.name
    #         form.article.data = post.article_text

    return render_template('article/mine_list.html')

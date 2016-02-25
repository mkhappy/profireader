from sqlalchemy import Integer, String, TIMESTAMP, SMALLINT, BOOLEAN, Column, ForeignKey, UnicodeText, BigInteger, \
    Binary, Float
from sqlalchemy.dialects.postgresql import BIGINT, INTEGER, JSON
from functools import reduce


class BinaryRightsMetaClass1(type):
    def _allrights(self):
        return {name: type.__getattribute__(self, name) for (name, val) in
                self.__dict__.items() if name not in ['__doc__', '__module__']}

    def _todict(self, bin):
        return {name: (True if ((1 << type.__getattribute__(self, name)) & bin) else False) for (name, val) in
                self._allrights().items()}

    def _tobin(self, dict):
        ret = 0
        all_rights = self._allrights()
        for (rightname, truefalse) in dict.items():
            if rightname == self._OWNER and truefalse:  # any right
                ret = 0x7fffffffffffffff
            else:
                bit_position = all_rights.get(rightname)
                if bit_position is None:
                    raise Exception(
                            "right `{}` doesn't exists in allowed columns rights: {}".format(rightname,
                                                                                             self._allrights()))
                else:
                    ret |= (1 << bit_position) if truefalse else 0

        return ret

    def __getattribute__(self, key):
        if key in ['_todict', '_tobin', '_allrights'] or (key[:2] == '__' and key[-2:] == '__'):
            return type.__getattribute__(self, key)
        elif key in type.__getattribute__(self, '_allrights')():
            return key
        elif key in ['_OWNER', '_ANY']:
            return key
        else:
            raise Exception(
                            "right `{}` doesn't exists in allowed columns rights: {}".format(key,
                                                                                             self._allrights()))


class BinaryRights(metaclass=BinaryRightsMetaClass1):
    _OWNER = -1
    _ANY = -2


class RIGHTS(BIGINT):
    _rights_class = None

    def __init__(self, rights):
        if isinstance(rights, BinaryRightsMetaClass1):
            self._rights_class = rights
        else:
            raise Exception(
                    'rights attribute should be BinaryRights class')

        super(RIGHTS, self).__init__()

    def result_processor(self, dialect, coltype):
        def process(value):
            return self._rights_class._todict(value)

        return process

    def bind_processor(self, dialect):
        def process(array):
            return self._rights_class._tobin(array)

        return process

    def adapt(self, impltype):
        return RIGHTS(self._rights_class)


# read this about UUID:
# http://stackoverflow.com/questions/183042/how-can-i-use-uuids-in-sqlalchemy
# http://stackoverflow.com/questions/20532531/how-to-set-a-column-default-to-a-postgresql-function-using-sqlalchemy
TABLE_TYPES = {
    'binary_rights': RIGHTS,
    'id_profireader': String(36),

    'password_hash': String(128),  # String(128) SHA-256
    'token': String(128),
    'timestamp': TIMESTAMP,
    'id_soc_net': String(50),
    'role': String(36),
    'location': String(64),

    'boolean': BOOLEAN,
    'status': String(36),
    'rights': String(40),
    'bigint': BIGINT,
    'int': INTEGER,
    'position': INTEGER,
    'float': Float,

    # http://sqlalchemy-utils.readthedocs.org/en/latest/data_types.html#module-sqlalchemy_utils.types.phone_number
    # 'phone': PhoneNumberType(country_code='UA'),  # (country_code='UA')
    'phone': String(50),  # (country_code='UA')

    # http://sqlalchemy-utils.readthedocs.org/en/latest/data_types.html#module-sqlalchemy_utils.types.url
    # read also https://github.com/gruns/furl
    # 'link': URLType,  # user = User(website=u'www.example.com'),
    'link': String(100),  # user = User(website=u'www.example.com'),
    'email': String(100),
    'name': String(200),
    'subtitle': String(1000),
    'string_30': String(30),
    'short_name': String(50),
    'title': String(100),
    'short_text': String(120),
    'keywords': String(1000),
    'credentials': String(1000),
    'text': UnicodeText(length=65535),
    'gender': String(6),
    'language': String(3),
    'url': String(1000),  # URLType,
    'binary': Binary,
    'json': JSON
}

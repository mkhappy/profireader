from profapp import create_app
import argparse

# if __name__ == '__main__':
parser = argparse.ArgumentParser(description='profireader application type')
parser.add_argument("apptype", default='profi')
args = parser.parse_args()
app = create_app(apptype=args.apptype)

if __name__ == '__main__':
    # app.run(host='127.40.71.198', port=8080)  #app.run(debug=True)
    if args.apptype == 'front':
        port = 8888
    elif args.apptype == 'file':
        port = 9001
    elif args.apptype == 'static':
        port = 9000
    else:
        port = 8080

    app.run(port=port, host='0.0.0.0', debug=True)  # app.run(debug=True)








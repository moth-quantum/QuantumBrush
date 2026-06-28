
import utils
def run(req):
    print('Utils module:', utils)
    return req['stroke_input']['image_rgba']

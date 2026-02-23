# gallery.py

from PIL import Image
from utils import resize_safe

def assemble_gallery(results, size):

    cols = 3
    rows = len(results)//cols + 1
    pad = 10

    w = cols*size + (cols+1)*pad
    h = rows*size + (rows+1)*pad

    gallery = Image.new("RGB",(w,h),(20,20,20))

    for idx,(name,img) in enumerate(results):

        row = idx//cols
        col = idx%cols

        x = pad + col*(size+pad)
        y = pad + row*(size+pad)

        gallery.paste(resize_safe(img,size),(x,y))

    return gallery

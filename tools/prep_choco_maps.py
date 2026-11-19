"""초코볼 다이어그램 지도 준비 (한 번만 돌림): 동 이름 지우기 + 학교 테두리선 얇게 얹기.
python3 tools/prep_choco_maps.py <백지도.png> <학교표시지도.jpg> <2014.png> <2024.png> <실험사진.jpg> <출력폴더>"""
import sys, cv2, numpy as np
from scipy import ndimage
from skimage.morphology import skeletonize

# 동 이름 글자가 있는 상자(1093x859 기준)
BOXES = [(258,22,392,58),(898,92,1017,132),(645,162,752,202),(862,228,972,267),(413,283,522,322),(538,333,628,372),
         (405,340,610,448),(282,447,388,484),(413,453,522,492),(1003,437,1093,477),(0,595,32,645),(0,695,28,750),
         (353,642,462,680),(327,697,437,737),(82,720,217,760),(295,755,402,795),(222,815,405,859),(1065,620,1093,665)]

def remove_names(img):
    b = img.astype(int); g = b.mean(2)
    rb = b[..., 2] - b[..., 0]
    warm = (rb >= 3) & (rb <= 12) & (g < 242)   # 글자는 옅은 따뜻한 회색(길은 무채색)
    mask = np.zeros(g.shape, np.uint8)
    for x0, y0, x1, y1 in BOXES: mask[y0:y1, x0:x1] = warm[y0:y1, x0:x1] * 255
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)
    return cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA)

def boundary(blank, school):
    # 학교 표시 지도의 굵은 회색 테두리(밝기 약 182, 폭 약 11px)만 골라 가운데 선으로
    from skimage.morphology import disk
    g = school.astype(int).mean(2); neu = (school.max(2).astype(int) - school.min(2)) < 14
    m = ndimage.binary_opening((g >= 168) & (g <= 196) & neu, structure=disk(4))
    lab, n = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, n + 1))
    return skeletonize(np.isin(lab, 1 + np.where(sz > 1500)[0])).astype(np.uint8)

def sea_mask(blank):
    # 오른쪽 아래 바다(밝기 228 회색의 넓은 영역)
    from skimage.morphology import disk
    g = blank.astype(int).mean(2); neu = (blank.max(2).astype(int) - blank.min(2)) < 14
    m = ndimage.binary_opening((g >= 222) & (g <= 234) & neu, structure=disk(5))
    lab, n = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, n + 1))
    return np.isin(lab, 1 + np.where(sz > 15000)[0])

# 인구 지도: 격자 칸(46.75px, 왼쪽 위 230.5,49.3)의 색을 중앙값으로 읽어 깨끗한 바탕 위에 다시 그림(칸 위 글자 제거)
def redraw_pop(pop, blank, base):
    d = np.abs(pop.astype(int) - blank.astype(int)).sum(2) > 12
    out = base.copy(); P, X0, Y0 = 46.75, 230.5, 49.3
    for j in range(16):
        for i in range(15):
            x0, y0 = round(X0 + i * P), round(Y0 + j * P); x1, y1 = round(X0 + (i + 1) * P), round(Y0 + (j + 1) * P)
            if x1 > pop.shape[1] or y1 > pop.shape[0]: continue
            if d[y0 + 4:y1 - 4, x0 + 4:x1 - 4].mean() < 0.5: continue
            c = np.median(pop[y0 + 4:y1 - 4, x0 + 4:x1 - 4].reshape(-1, 3), axis=0)
            out[y0:y1, x0:x1] = c
            cv2.rectangle(out, (x0, y0), (x1, y1), (228, 228, 228), 1)
    return out

def main(blank_p, school_p, p14, p24, choco_p, out):
    blank = cv2.imread(blank_p); school = cv2.imread(school_p)
    base = remove_names(blank)
    line = cv2.GaussianBlur(cv2.dilate(boundary(blank, school) * 255, np.ones((3, 3), np.uint8)).astype(np.float32), (3, 3), 0) / 255
    a = np.clip(line * 1.2, 0, 1)[..., None]
    cv2.imwrite(f'{out}/map-base.png', (base * (1 - a) + np.array([105, 105, 105]) * a).astype(np.uint8))
    cv2.imwrite(f'{out}/sea-mask.png', sea_mask(blank).astype(np.uint8) * 255)   # 흰색 = 바다(학교·X를 못 놓음)
    cv2.imwrite(f'{out}/pop-2014.png', redraw_pop(cv2.imread(p14), blank, base))
    cv2.imwrite(f'{out}/pop-2024.png', redraw_pop(cv2.imread(p24), blank, base))
    c = cv2.imread(choco_p); k = 1600 / max(c.shape[:2])
    cv2.imwrite(f'{out}/teacher-choco.jpg', cv2.resize(c, (round(c.shape[1] * k), round(c.shape[0] * k)), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])

if __name__ == '__main__':
    main(*sys.argv[1:7])

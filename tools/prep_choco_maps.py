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
    # 학교 표시 지도의 굵은 회색 테두리(폭 약 11px)만: 가운데에서 가장자리까지 4.5px 넘는 굵은 부분(가는 길은 빠짐)
    # → 끊긴 곳(철길과 겹친 곳) 잇기 → 큰 덩어리만 → 가운데 선
    from skimage.morphology import disk
    g = school.astype(int).mean(2); neu = (school.max(2).astype(int) - school.min(2)) < 14
    raw = (g >= 160) & (g <= 200) & neu
    core = ndimage.distance_transform_edt(raw) >= 4.5
    m = ndimage.binary_closing(ndimage.binary_dilation(core, structure=disk(5)), structure=disk(9))
    lab, n = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, n + 1))
    return prune(skeletonize(np.isin(lab, 1 + np.where(sz > 3000)[0])).astype(np.uint8))

def prune(sk, maxlen=45):
    # 테두리 고리에 붙은 짧은 잔가지(끝점에서 갈림길까지 maxlen px 미만) 지우기
    sk = sk.copy(); H, W = sk.shape
    nb = lambda y, x: [(y + dy, x + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and 0 <= y + dy < H and 0 <= x + dx < W and sk[y + dy, x + dx]]
    for y, x in zip(*np.nonzero(sk)):
        if not sk[y, x] or len(nb(y, x)) != 1: continue
        path, prev, cur = [], None, (y, x)
        while True:
            path.append(cur); n = [q for q in nb(*cur) if q != prev and q not in path]
            if len(n) != 1 or len(path) > maxlen: break
            prev, cur = cur, n[0]
        if len(path) <= maxlen and len(n) >= 2:
            for q in path: sk[q] = 0
    return sk

def land_border(blank, school):
    # 테두리 고리 안쪽을 채우고, 바다와 가까운 곳은 실제 해안선(흰 땅과 회색 바다의 경계)까지 맞춤 → 그 땅 영역의 바깥선
    from skimage.morphology import disk
    d = ndimage.binary_dilation(boundary(blank, school).astype(bool), structure=disk(2)); d[-1, 470:620] = True   # 아래 가장자리에서 닫기
    f = ndimage.binary_fill_holes(d)
    g = blank.astype(int).mean(2); sea = sea_mask(blank); sea = sea | (ndimage.binary_dilation(sea, structure=disk(2)) & (g < 240))
    ext = ndimage.binary_dilation(f, structure=disk(28)) & (ndimage.distance_transform_edt(~sea) < 28) & ~f
    R = (f | ndimage.binary_opening(ext, structure=disk(5))) & ~sea
    R[398:, 862:] = False   # 오른쪽 운하 옆 가는 땅줄기는 동구 밖(원래 테두리가 y≈395에서 꺾임)
    R = ndimage.binary_opening(R, structure=disk(3)); lab, n = ndimage.label(R); sz = ndimage.sum(R, lab, range(1, n + 1))
    R = ndimage.binary_fill_holes(lab == 1 + np.argmax(sz))
    cs, _ = cv2.findContours(R.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = np.zeros(g.shape, np.uint8); cv2.drawContours(out, cs, -1, 1, 1); out[-2:] = 0
    return out

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
    line = cv2.GaussianBlur(cv2.dilate(land_border(blank, school) * 255, np.ones((5, 5), np.uint8)).astype(np.float32), (3, 3), 0) / 255
    a = np.clip(line * 1.2, 0, 1)[..., None]
    cv2.imwrite(f'{out}/map-base.png', (base * (1 - a) + np.array([120, 120, 120]) * a).astype(np.uint8))   # 회색 테두리
    cv2.imwrite(f'{out}/sea-mask.png', sea_mask(blank).astype(np.uint8) * 255)   # 흰색 = 바다(학교·X를 못 놓음)
    cv2.imwrite(f'{out}/pop-2014.png', redraw_pop(cv2.imread(p14), blank, base))
    cv2.imwrite(f'{out}/pop-2024.png', redraw_pop(cv2.imread(p24), blank, base))
    c = cv2.imread(choco_p); k = 1600 / max(c.shape[:2])
    cv2.imwrite(f'{out}/teacher-choco.jpg', cv2.resize(c, (round(c.shape[1] * k), round(c.shape[0] * k)), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])

if __name__ == '__main__':
    main(*sys.argv[1:7])

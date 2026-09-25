"""★스캔본을 «전부» OCR 한다 — 기계 눈 한 벌.

대표(2026-08-27):
  「다 읽고 파이어베이스에 몇만 줄을 입력하더라도 **완벽하게** 해야지」
  「ocr은 **교차검증**할 거야. 니가 보고 적은 거랑 다른 ai가 보고 적은 거 합치는 거야. **4개의 ai가**」
  「니가 ocr한 거랑 **칸 2개 더 비워서 커서 코덱스 다 ocr** 하라 그래」

★이 파일은 «기계 눈(easyocr)» 한 벌만 낸다. 나머지 셋은 AI 눈이다.
  그래서 결과에 「기계눈」 이라고 이름을 박는다 — 이게 정답이라는 뜻이 아니다.

── ★기계 눈이 어디서 틀리나 (실측 2026-08-27, 311마8929 등록증)
    「제이피테이오토실렉선」   ← 제이피케이오토셀렉션   (모양이 닮은 글자)
    「VBAJC5IO7JWB8543O」   ← I/1 · O/0 을 헷갈린다
  ★사람 이름·법인명·차대번호가 특히 위태롭다. 그래서 AI 눈이 필요하다.

── ★쪽 전체를 읽는다. 자르지 않는다
  윗부분만 읽으면 빠르지만 아래에 있는 것을 잃는다:
    「자동차 출고(취득)가격 (부가세제외) : 56,181,818」  ← 매각 시세의 밑값
    「저당권등록사실」 · 「번호판발급일」
  ★대표: 「다 읽고 … 완벽하게」 — 빠른 것보다 안 잃는 것이 먼저다.

  python scripts/ocr.py <목록.json> <낼곳.json> [--워커=12] [--dpi=200]
     목록.json = [{"id": "...", "길": "tmp/등록증/xxx.pdf"}, ...]
"""
import sys, os, json, time
from concurrent.futures import ProcessPoolExecutor

목록길 = sys.argv[1]
낼곳 = sys.argv[2]
워커 = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--워커=')), 0)) or max(2, (os.cpu_count() or 4) - 4)
DPI = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--dpi=')), 200))

# ★★어느 쪽을 읽을지 고른다 — 「--쪽=1,2,4」
#
#  ── 실측(2026-08-27): 계약서 스캔본 1,203장이 «16,525쪽» 이다 (한 장에 13.7쪽).
#    다 읽으면 27시간이 걸린다. 그런데 글자층 계약서 40장을 재 보니
#        1쪽  차번 40 · 임차인 38 · 계약일 27 · 전화 35
#        2쪽  차번 39 · 임차인 39 · ★주민 38 · 전화 37
#        4쪽  차번 38 · 임차인 39 · ★주민 38
#    ★쓸 것이 1·2·4쪽에 다 있다. 나머지는 약관·동의서다.
#  ★「다 읽는다」 가 목적이 아니라 「다 안다」 가 목적이다 — 16,525쪽 → 3,609쪽

_읽개 = None
def 읽개():
    """★일꾼마다 모델을 한 번만 올린다 — 장마다 올리면 2초씩 버린다"""
    global _읽개
    if _읽개 is None:
        import easyocr
        _읽개 = easyocr.Reader(['ko', 'en'], gpu=False, verbose=False)
    return _읽개

그림꼴 = ('.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp', '.webp')

고를쪽 = [int(n) - 1 for n in (next((a.split('=')[1] for a in sys.argv if a.startswith('--쪽=')), '') or '').split(',') if n.strip().isdigit()]

def 그림한장(일):
    """★그림 파일(jpg·png·tif)을 읽는다.

    ── 실측(2026-08-27): 프라임 자동차등록증 866장 가운데 PDF 는 **4장** 뿐이고
       나머지 862장이 **jpg 837 · png 14 · tif 11** 이었다.
       ★PDF 만 보던 도구가 862장을 통째로 건너뛰고도 아무 데도 안 남겼다.
    """
    import numpy as np, time as _t
    from PIL import Image
    t0 = _t.time()
    try:
        im = Image.open(일['길'])
        im.load()
    except Exception as e:
        return {'id': 일['id'], '됐나': False, '왜': f'그림을 못 열었다 — {e}'}
    try:
        # ★작은 그림은 키운다 — 글자가 뭉개져 있으면 못 읽는다
        w, h = im.size
        if max(w, h) < 1400:
            k = 1400 / max(w, h)
            im = im.resize((int(w * k), int(h * k)), Image.LANCZOS)
        img = np.array(im.convert('RGB'))
        난 = 읽개().readtext(img, detail=1)
        H, W = img.shape[0], img.shape[1]
        줄 = [{'글': t, '믿음': round(float(c), 3),
               'x': round(sum(p[0] for p in b) / 4 / W, 4),
               'y': round(sum(p[1] for p in b) / 4 / H, 4)} for b, t, c in 난]
    except Exception as e:
        return {'id': 일['id'], '됐나': False, '왜': f'OCR 이 엎어졌다 — {e}'}
    return {'id': 일['id'], '됐나': True, '쪽수': 1,
            '조각': [{'쪽': 1, '어디서': '기계눈(easyocr)', '줄': 줄, '글': ' '.join(x['글'] for x in 줄)}],
            '걸린초': round(_t.time() - t0, 1)}

def 한장(일):
    import numpy as np, fitz
    t0 = time.time()
    if str(일['길']).lower().endswith(그림꼴):
        return 그림한장(일)
    try:
        d = fitz.open(일['길'])
    except Exception as e:
        return {'id': 일['id'], '됐나': False, '왜': f'파일을 못 열었다 — {e}'}
    조각 = []
    쪽수 = len(d)
    try:
        r = 읽개()
        # ★「--쪽=1,2,4」 로 고른 쪽만. 안 고르면 앞 3쪽 (등록증·증권은 3쪽을 안 넘는다)
        볼쪽 = [i for i in 고를쪽 if i < 쪽수] if 고를쪽 else list(range(min(쪽수, 3)))
        for pi in 볼쪽:
            pg = d[pi]
            글 = pg.get_text().strip()
            if 글:                               # ★글자가 있으면 OCR 이 필요 없다
                조각.append({'쪽': pi + 1, '어디서': '글자층', '글': 글})
                continue
            pix = pg.get_pixmap(dpi=DPI)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]
            # ★자리(y)까지 남긴다 — 어느 칸의 값인지 나중에 가릴 때 쓴다
            난 = r.readtext(img, detail=1)
            줄 = [{'글': t, '믿음': round(float(c), 3),
                   'x': round(sum(p[0] for p in b) / 4 / pix.width, 4),
                   'y': round(sum(p[1] for p in b) / 4 / pix.height, 4)} for b, t, c in 난]
            조각.append({'쪽': pi + 1, '어디서': '기계눈(easyocr)', '줄': 줄,
                         '글': ' '.join(x['글'] for x in 줄)})
    except Exception as e:
        return {'id': 일['id'], '됐나': False, '왜': f'OCR 이 엎어졌다 — {e}'}
    finally:
        d.close()
    return {'id': 일['id'], '됐나': True, '쪽수': 쪽수, '조각': 조각, '걸린초': round(time.time() - t0, 1)}

if __name__ == '__main__':
    일들 = json.load(open(목록길, encoding='utf-8'))

    # ★★이미 읽은 것은 다시 안 읽는다 — 중간에 죽어도 이어서 간다
    #   실측(2026-08-27): 워커 14 · 6 이 메모리를 다 먹고 터졌다.
    #   그때 «다 끝나야 저장» 하는 구조라 읽은 것을 통째로 잃었다.
    #   ★죽는 건 막을 수 없다. 잃지 않게 만드는 게 맞다.
    낸것 = []
    본id = set()
    if os.path.exists(낼곳):
        try:
            낸것 = json.load(open(낼곳, encoding='utf-8'))
            본id = {x['id'] for x in 낸것 if x.get('됐나')}
            print(f'★이미 읽어 둔 것 {len(본id)}장 — 이어서 간다', flush=True)
        except Exception:
            낸것 = []

    할것 = [x for x in 일들 if x['id'] not in 본id]
    print(f'★{len(할것)}장 읽는다 (전체 {len(일들)}) · 일꾼 {워커}명 · dpi {DPI}', flush=True)
    if not 할것:
        print('★다 읽었다'); sys.exit(0)

    t0 = time.time()

    def 저장():
        임시 = 낼곳 + '.tmp'
        json.dump(낸것, open(임시, 'w', encoding='utf-8'), ensure_ascii=False)
        os.replace(임시, 낼곳)          # ★쓰다 죽어도 먼젓번 것이 안 깨지게

    # ★★워커 1이면 «한 프로세스 안에서» 차례로 읽는다.
    #
    #  ── 실측(2026-08-27): ProcessPoolExecutor 를 워커 14 · 6 · 3 으로 다 돌려 봤는데
    #    셋 다 BrokenProcessPool 로 터졌다. 메모리는 12GB 남아 있었다 — 메모리 탓이 아니다.
    #    (윈도우에서 PyTorch 가 spawn 으로 뜨는데 풀과 궁합이 나쁘다)
    #  ★그래서 «풀을 안 쓰는» 길을 둔다. 여러 대를 돌리고 싶으면
    #    목록을 나눠 이 파일을 «따로» 여러 번 부르면 된다 — 프로세스가 서로 남남이라 안 깨진다
    if 워커 <= 1:
        for i, 일 in enumerate(할것, 1):
            try:
                낸것.append(한장(일))
            except Exception as e:
                낸것.append({'id': 일['id'], '됐나': False, '왜': f'엎어졌다 — {type(e).__name__} {e}'})
            if i % 10 == 0 or i == len(할것):
                저장()
                지난 = time.time() - t0
                남은 = 지난 / i * (len(할것) - i)
                print(f'\r   {i}/{len(할것)}  {지난/60:.1f}분 지남 · 남은 {남은/60:.1f}분   ', end='', flush=True)
        저장()
        됨 = sum(1 for x in 낸것 if x['됐나'])
        print(f'\n★{됨}/{len(낸것)} 읽음 · {(time.time()-t0)/60:.1f}분 → {낼곳}')
        sys.exit(0)

    # ★한 덩이(뭉치)씩 일꾼을 새로 띄운다 — 일꾼이 오래 살수록 메모리가 는다
    뭉치 = max(20, 워커 * 8)
    for 시작 in range(0, len(할것), 뭉치):
        덩이 = 할것[시작:시작 + 뭉치]
        try:
            with ProcessPoolExecutor(max_workers=워커) as ex:
                for r in ex.map(한장, 덩이, chunksize=2):
                    낸것.append(r)
        except Exception as e:
            # ★일꾼이 터져도 여태 읽은 것은 지킨다
            print(f'\n★일꾼이 터졌다 ({type(e).__name__}) — 여태 읽은 {len(낸것)}장은 지킨다', flush=True)
            저장()
            print('★워커를 줄여 다시 부르십시오 —  --워커=2', flush=True)
            sys.exit(2)
        저장()
        한 = 시작 + len(덩이)
        지난 = time.time() - t0
        남은 = 지난 / max(1, 한) * (len(할것) - 한)
        print(f'\r   {한}/{len(할것)}  {지난/60:.1f}분 지남 · 남은 {남은/60:.1f}분   ', end='', flush=True)

    저장()
    됨 = sum(1 for x in 낸것 if x['됐나'])
    print(f'\n★{됨}/{len(낸것)} 읽음 · {(time.time()-t0)/60:.1f}분 → {낼곳}')
    안된것 = [x for x in 낸것 if not x['됐나']]
    if 안된것:
        print(f'★못 읽은 것 {len(안된것)}:')
        for x in 안된것[:12]:
            print('   ', x['id'], x['왜'])

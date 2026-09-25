"""★계약서에 «글자층» 이 있나 — 있으면 기계가 값을 «전부» 읽는다.

대표(2026-08-28): 「ㅇㅇ 프리패스가 계약서 써줬으니까」
  ★프리패스 계약서를 열어 보니 «모두싸인(Modusign) 전자계약» 이었다.
    글자층에 값이 다 있었다 — 차번·이름·주민번호·대여료·해지수수료율까지.

── ★★그러면 물음이 바뀐다
  「손글씨를 어떻게 읽나」 가 아니라
  ★「**글자층이 있는 계약서가 몇 장인가**」 다. 그건 한 번에 다 읽힌다.

  ★계약서가 넷으로 갈린다
      ① 손글씨 스캔        기계가 못 읽는다 — AI 눈이 읽는다
      ② Signon 전자계약     인쇄라 기계도 읽는다
      ③ ★Modusign 전자계약  글자층 완전 — 값을 통째로 뽑는다
      ④ 계약서가 아닌 것

  python scripts/geulja-cheung.py <목록.json> <낼곳.json>
"""
import sys, os, json, time, re

목록길, 낼곳 = sys.argv[1], sys.argv[2]

전자표 = [
    ('Modusign', re.compile(r'Modusign\s*Document\s*ID', re.I)),
    ('모두싸인', re.compile(r'모두싸인')),
    ('Signon', re.compile(r'sign\s*on|싸인온|SignOn', re.I)),
    ('이싸인온', re.compile(r'이싸인온')),
]

def 한장(일):
    길 = 일['길']
    try:
        import fitz
        d = fitz.open(길)
        쪽수 = d.page_count
        글 = []
        for i in range(min(쪽수, 40)):
            글.append(d[i].get_text())
        d.close()
    except Exception as e:
        return {'id': 일['id'], '됐나': False, '왜': f'{type(e).__name__} {str(e)[:60]}'}

    온글 = '\n'.join(글)
    빈글 = re.sub(r'\s', '', 온글)
    글자수 = len(빈글)
    # ★쪽마다 글자가 있나 — 몇 쪽이 «글자층» 인가
    글있는쪽 = sum(1 for g in 글 if len(re.sub(r'\s', '', g)) >= 40)
    어디서 = next((n for n, p in 전자표 if p.search(온글)), None)
    return {
        'id': 일['id'], '됐나': True, '쪽수': 쪽수,
        '글자수': 글자수, '글있는쪽': 글있는쪽,
        '글자층인가': 글자수 >= 300 and 글있는쪽 >= 1,
        '전자계약': 어디서,
        '글': 온글[:20000],
    }

if __name__ == '__main__':
    일들 = json.load(open(목록길, encoding='utf-8'))
    낸것, 본 = [], set()
    if os.path.exists(낼곳):
        try:
            낸것 = json.load(open(낼곳, encoding='utf-8'))
            본 = {x['id'] for x in 낸것 if x.get('됐나')}
            print(f'★이미 본 것 {len(본)}장 — 이어서', flush=True)
        except Exception:
            낸것 = []
    할것 = [x for x in 일들 if x['id'] not in 본]
    print(f'★{len(할것)}장 본다 (전체 {len(일들)})', flush=True)
    t0 = time.time()
    for i, 일 in enumerate(할것, 1):
        낸것.append(한장(일))
        if i % 25 == 0 or i == len(할것):
            json.dump(낸것, open(낼곳 + '.tmp', 'w', encoding='utf-8'), ensure_ascii=False)
            os.replace(낼곳 + '.tmp', 낼곳)
            print(f'\r   {i}/{len(할것)}  {(time.time()-t0)/60:.1f}분   ', end='', flush=True)
    json.dump(낸것, open(낼곳 + '.tmp', 'w', encoding='utf-8'), ensure_ascii=False)
    os.replace(낼곳 + '.tmp', 낼곳)
    됨 = [x for x in 낸것 if x.get('됐나')]
    글층 = [x for x in 됨 if x.get('글자층인가')]
    print(f'\n★{len(됨)}장 봤다 · ★글자층이 있는 것 {len(글층)}장 ({len(글층)/max(1,len(됨))*100:.0f}%)')
    갈래 = {}
    for x in 글층:
        k = x.get('전자계약') or '(양식 모름)'
        갈래[k] = 갈래.get(k, 0) + 1
    for k, v in sorted(갈래.items(), key=lambda a: -a[1]):
        print(f'   {k:16s}{v:5d}장')

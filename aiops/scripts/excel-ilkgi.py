"""★엑셀을 «전부» 읽는다 — 돈의 정본이 여기 있다.

대표(2026-08-27):
  「어려운 거 아니면 **데이터센터 거 다 마스터**를 해」
  「다 읽고 파이어베이스에 몇만 줄을 입력하더라도 **완벽하게** 해야지」

── ★엑셀에 무엇이 묻혀 있었나 (문서 대장으로 세어 보니)
    세금계산서 목록   320장   ← 매출·매입 정본
    계좌 입출금        99장   ← 자금일보 원자료
    CMS 결제내역       94장   ← 수납 정본
    계정별원장         74장   ← 회계
    여신·정산서       142장
  ★도구가 PDF 만 보고 있어서 이것이 통째로 흘러가고 있었다.
    「PDF 가 아니다」 로 뭉뚱그리면 «돈» 을 잃는다.

── ★엑셀은 «표» 다. 그런데 우리 시트는 표가 아니다
    · 머리줄이 1행이 아니다 (제목·공지가 위에 있다)
    · 한 장에 표가 여럿이다
    · 병합된 칸이 있다
  ★그래서 «머리줄을 찾아» 읽는다. 1행이라고 믿지 않는다 —
    운영관리 시트에서 겪은 그것과 같다.

── ★값을 «날것으로» 남긴다
  서식된 값(1,234,000원)과 셀에 든 수(1234000)가 다르다.
  ★서식을 믿지 않고 셀 값을 쓴다. 서식만 있으면 그것도 함께 남긴다.

  python scripts/excel-ilkgi.py <목록.json> <낼곳.json>
     목록.json = [{"id": "...", "길": "tmp/엑셀/xxx.xlsx"}, ...]
"""
import sys, os, json, time

목록길 = sys.argv[1]
낼곳 = sys.argv[2]
최대줄 = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--최대줄=')), 4000))

def 셀값(v):
    """★날짜는 문자로, 수는 수로. None 은 None 으로 (빈 칸과 0 은 다르다)"""
    import datetime as dt
    if v is None:
        return None
    if isinstance(v, (dt.datetime, dt.date)):
        return v.strftime('%Y-%m-%d')
    if isinstance(v, dt.time):
        return v.strftime('%H:%M')
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v

def 머리줄찾기(줄들):
    """★머리줄이 1행이라고 믿지 않는다.

    ── 실측: 우리 시트는 위에 제목·공지가 있고 머리가 3~6행에 있다.
    ★«글자가 든 칸이 가장 많은 줄» 을 머리로 본다. 다만 앞 12줄 안에서만 찾는다 —
      그보다 아래면 그건 머리가 아니라 «값» 이다.
    """
    최고, 자리 = 0, 0
    for i, 줄 in enumerate(줄들[:12]):
        찬 = sum(1 for c in 줄 if isinstance(c, str) and c.strip())
        # ★수가 섞인 줄은 머리가 아니다 — 머리는 글자다
        수 = sum(1 for c in 줄 if isinstance(c, (int, float)))
        if 찬 >= 2 and 찬 > 최고 and 수 <= 찬:
            최고, 자리 = 찬, i
    return 자리

def 한장(일):
    길 = 일['길']
    낮 = 길.lower()
    t0 = time.time()
    낸탭 = []
    try:
        if 낮.endswith(('.xlsx', '.xlsm')):
            import openpyxl
            wb = openpyxl.load_workbook(길, data_only=True, read_only=True)
            for 탭 in wb.sheetnames:
                ws = wb[탭]
                # ★★파일이 적어 둔 «치수» 를 믿지 않는다.
                #
                #  ── 실측(2026-08-28): 은행에서 받은 계좌내역 xlsx 는 dimension 이 「A1:A1」 이다.
                #    read_only 모드가 그걸 믿어 **첫 열 하나만** 읽었다.
                #    계좌 68,112줄이 「No」 칸 하나로만 들어와 있었다 —
                #    거래일시·적요·입금액·출금액·잔액이 통째로 빠진 채로.
                #  ★「값이 없다」 가 아니라 「내가 안 읽었다」 였다.
                try:
                    ws.reset_dimensions()
                except Exception:
                    pass
                줄들 = []
                for r in ws.iter_rows(max_row=최대줄, values_only=True):
                    줄들.append([셀값(c) for c in r])
                낸탭.append({'탭': 탭, '줄': 줄들})
            wb.close()
        elif 낮.endswith('.xls'):
            import xlrd
            wb = xlrd.open_workbook(길)
            for ws in wb.sheets():
                줄들 = []
                for i in range(min(ws.nrows, 최대줄)):
                    r = []
                    for j in range(ws.ncols):
                        c = ws.cell(i, j)
                        v = c.value
                        if c.ctype == 3:                      # ★엑셀 날짜는 «수» 로 들어 있다
                            try:
                                import datetime as dt
                                y, mo, d, h, mi, s = xlrd.xldate_as_tuple(v, wb.datemode)
                                v = f'{y:04d}-{mo:02d}-{d:02d}' if y else f'{h:02d}:{mi:02d}'
                            except Exception:
                                pass
                        elif isinstance(v, float) and v.is_integer():
                            v = int(v)
                        elif v == '':
                            v = None
                        r.append(v)
                    줄들.append(r)
                낸탭.append({'탭': ws.name, '줄': 줄들})
        elif 낮.endswith('.xlsb'):
            from pyxlsb import open_workbook
            with open_workbook(길) as wb:
                for 탭 in wb.sheets:
                    with wb.get_sheet(탭) as ws:
                        줄들 = []
                        for i, r in enumerate(ws.rows()):
                            if i >= 최대줄:
                                break
                            줄들.append([c.v for c in r])
                    낸탭.append({'탭': 탭, '줄': 줄들})
        elif 낮.endswith('.csv'):
            import csv
            with open(길, encoding='utf-8-sig', errors='replace') as f:
                줄들 = [r for i, r in enumerate(csv.reader(f)) if i < 최대줄]
            낸탭.append({'탭': '(csv)', '줄': 줄들})
        else:
            return {'id': 일['id'], '됐나': False, '왜': f'엑셀 꼴이 아니다 — {os.path.splitext(길)[1]}'}
    except Exception as e:
        return {'id': 일['id'], '됐나': False, '왜': f'{type(e).__name__} {str(e)[:80]}'}

    # ★탭마다 «머리줄» 을 찾아 붙인다 — 1행이라고 믿지 않는다
    for t in 낸탭:
        줄 = t['줄']
        hi = 머리줄찾기(줄)
        t['머리줄자리'] = hi
        t['머리'] = [str(c).strip() if c is not None else '' for c in (줄[hi] if hi < len(줄) else [])]
        t['줄수'] = len(줄)
        # ★빈 줄을 뺀 «값 줄» 수 — 표가 실제로 얼마나 찼나
        t['값줄수'] = sum(1 for r in 줄[hi + 1:] if any(c is not None and str(c).strip() != '' for c in r))

    return {'id': 일['id'], '됐나': True, '탭수': len(낸탭), '탭': 낸탭, '걸린초': round(time.time() - t0, 1)}

if __name__ == '__main__':
    일들 = json.load(open(목록길, encoding='utf-8'))
    낸것, 본id = [], set()
    if os.path.exists(낼곳):
        try:
            낸것 = json.load(open(낼곳, encoding='utf-8'))
            본id = {x['id'] for x in 낸것 if x.get('됐나')}
            print(f'★이미 읽어 둔 것 {len(본id)}장 — 이어서 간다', flush=True)
        except Exception:
            낸것 = []
    할것 = [x for x in 일들 if x['id'] not in 본id]
    print(f'★엑셀 {len(할것)}장 읽는다 (전체 {len(일들)})', flush=True)
    t0 = time.time()
    for i, 일 in enumerate(할것, 1):
        try:
            낸것.append(한장(일))
        except Exception as e:
            낸것.append({'id': 일['id'], '됐나': False, '왜': f'엎어졌다 — {type(e).__name__} {e}'})
        if i % 10 == 0 or i == len(할것):
            임시 = 낼곳 + '.tmp'
            json.dump(낸것, open(임시, 'w', encoding='utf-8'), ensure_ascii=False)
            os.replace(임시, 낼곳)
            print(f'\r   {i}/{len(할것)}  {(time.time()-t0)/60:.1f}분   ', end='', flush=True)
    임시 = 낼곳 + '.tmp'
    json.dump(낸것, open(임시, 'w', encoding='utf-8'), ensure_ascii=False)
    os.replace(임시, 낼곳)
    됨 = sum(1 for x in 낸것 if x['됐나'])
    print(f'\n★{됨}/{len(낸것)} 읽음 → {낼곳}')
    안된것 = [x for x in 낸것 if not x['됐나']]
    if 안된것:
        까닭 = {}
        for x in 안된것:
            까닭[x['왜'][:60]] = 까닭.get(x['왜'][:60], 0) + 1
        print(f'★못 읽은 것 {len(안된것)}:')
        for k, v in sorted(까닭.items(), key=lambda a: -a[1]):
            print(f'   {v:4d}  {k}')

"""Devanagari -> IAST (Roman) transliteration for Sanskrit, done by fixed rules.

Every output letter comes mechanically from the source Devanagari; nothing is added by hand.
"""
V = {'अ': 'a', 'आ': 'ā', 'इ': 'i', 'ई': 'ī', 'उ': 'u', 'ऊ': 'ū', 'ऋ': 'ṛ', 'ॠ': 'ṝ', 'ऌ': 'ḷ',
     'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'ŏ'}
M = {'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū', 'ृ': 'ṛ', 'ॄ': 'ṝ', 'ॢ': 'ḷ',
     'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'ŏ'}
C = {'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ṅ', 'च': 'c', 'छ': 'ch', 'ज': 'j', 'झ': 'jh',
     'ञ': 'ñ', 'ट': 'ṭ', 'ठ': 'ṭh', 'ड': 'ḍ', 'ढ': 'ḍh', 'ण': 'ṇ', 'त': 't', 'थ': 'th', 'द': 'd',
     'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r',
     'ल': 'l', 'ळ': 'ḷ', 'व': 'v', 'श': 'ś', 'ष': 'ṣ', 'स': 's', 'ह': 'h'}
NUKTA = {'क': 'q', 'ख': 'ḵh', 'ग': 'ġ', 'ज': 'z', 'ड': 'ṛ', 'ढ': 'ṛh', 'फ': 'f'}
PRE_NUKTA = {'क़': 'q', 'ख़': 'ḵh', 'ग़': 'ġ', 'ज़': 'z', 'ड़': 'ṛ', 'ढ़': 'ṛh', 'फ़': 'f'}
O = {'ं': 'ṃ', 'ः': 'ḥ', 'ँ': 'm̐', 'ऽ': "'", '॥': '||', '।': '|', 'ॐ': 'oṃ', '॰': '.'}
D = dict(zip('०१२३४५६७८९', '0123456789'))


def iast(s):
    out = []
    i = 0
    n = len(s)
    while i < n:
        ch = s[i]
        if ch in PRE_NUKTA or ch in C:
            base = PRE_NUKTA.get(ch, C.get(ch))
            nx = s[i + 1] if i + 1 < n else ''
            if nx == '़':
                base = NUKTA.get(ch, base)
                i += 1
                nx = s[i + 1] if i + 1 < n else ''
            out.append(base)
            if nx == '्':
                i += 2
                continue
            if nx in M:
                out.append(M[nx])
                i += 2
                continue
            out.append('a')
            i += 1
            continue
        if ch in V:
            out.append(V[ch])
        elif ch in O:
            out.append(O[ch])
        elif ch in D:
            out.append(D[ch])
        elif ch in M:
            out.append(M[ch])
        elif ch in ('्', '़', '‌', '‍'):
            pass
        else:
            out.append(ch)
        i += 1
    return ''.join(out)


if __name__ == '__main__':
    for t in ['कर्मण्येवाधिकारस्ते मा फलेषु कदाचन ।',
              'मा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि ॥४७॥',
              'धृतराष्ट्र उवाच', 'नैनं छिन्दन्ति शस्त्राणि नैनं दहति पावकः ।']:
        print(iast(t))

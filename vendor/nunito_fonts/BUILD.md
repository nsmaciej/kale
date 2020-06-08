# Build Fonts 

Special hinting options must be applied because of a reported ttfautohint [bug][issue]:

```
ttfautohint -v -a nnn  
```

1. Generate unhinted TTFs to `fonts/TTF-unhinted` folder
2. Run hint.py script from the scripts folder

```
python scripts/hint.py
```
Autohinted fonts will be exported into `fonts/TTF` folder.

[issue]: https://github.com/google/fonts/issues/632#issuecomment-346515800
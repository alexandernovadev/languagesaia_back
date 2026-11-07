# Datos del diccionario

`claude-entries-<idioma>[-N].json`: fichas de palabras escritas por Claude a mano, por tandas. Las carga `pnpm seed:dictionary` en el diccionario compartido.

`common-words-pt.json`: palabras por orden de frecuencia real, en su forma de diccionario. Es la referencia de `rank` que se sigue para escribir las fichas.

Fuente de la frecuencia: [FrequencyWords](https://github.com/hermitdave/FrequencyWords) de Hermit Dave, a partir de OpenSubtitles 2018. Contenido bajo licencia CC-BY-SA 4.0. Las listas de aquí son una adaptación: se agruparon las formas conjugadas y se quitaron nombres y palabras de otros idiomas.

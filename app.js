const express = require('express');
const superagent = require('superagent');
const cheerio = require('cheerio');
const app = express();

const vipPrefixList = [
  'https://jx.aidouer.net/?url=',
  'https://api.okjx.cc:3389/jx.php?url=',
  'https://api.jiexi.la/?url=',
  'https://okjx.cc/?url=',
  'http://vip.8bys.cn/?url=',
  'http://www.ckmov.vip/api.php?url=',
  'http://jx.youyitv.com/?url=',
  'https://www.administratorw.com/index/qqvod.php?url=',
  'https://vip.mmkv.cn/tv.php?url='
]

let gLine = 0

const userAgend = ['user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36']

const tpl = (str) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  ${str}
</body>
</html>
`

const loadEpisodeList = (req, res, next, sres) => {
  let dataUrl = sres.text.match(/(https\:\/\/img3\.doubanio\.com\/misc\/mixed_static\/\w*\.js)/g) || []
  console.log('douban episode: ', dataUrl)
  if (dataUrl.length) {
    dataUrl.forEach(url => {
      superagent.get(url)
      .set(...userAgend)
      .buffer(true)
      .end((err, sre) => {
        if (err) {
          return next(err);
        }
        const links = sre.text.match(/(?<=https\:\/\/www\.douban\.com\/link2\/\?url\=).*?html/g)
        console.log('links: ',links)
        if (links) {
          const prefix = vipPrefixList[gLine]
          const result = links.map((url, index) => ({
            title: index + 1,
            href: prefix + decodeURIComponent(url)
          }))
          res.send(
            tpl(result.map(i => `<a href=${i.href}>${i.title}</a>`).join('<br />'))
          );
        }
      })
    })
  }
}

const interceptUrlFromDouban = (str) => {
  const urls = str.match(/(?<=https\:\/\/www\.douban\.com\/link2\/\?url\=).*?html/g) || []
  const prefix = vipPrefixList[gLine]
  return Array.from(urls).map(url => prefix + decodeURIComponent(url))
}

app.get('/', (req, res, next) =>  {
  const key = req.query.key || ''
  const q = req.query.q || ''

  if (q) {
    superagent.get(`https://movie.douban.com/j/subject_suggest?q==${encodeURIComponent(q)}`).set(...userAgend)
      .end((err, sres) => {
        if (err) {
          return next(err);
        }
        const lists = JSON.parse(sres.text)
        console.log('douban return: ', lists)
        if (lists.length > 0) {
          const links = lists.map(a => ({
            title: a.title,
            href: `/?key=${a.id}`
          }))
          res.send(
            tpl(links.map(i => `<a href=${i.href}>${i.title}</a>`).join('<br />'))
          );
        } else {
          res.send('没有资源')
        }
      })
  } else if (key) {
    superagent.get(`https://movie.douban.com/subject/${key}/`)
      .set(...userAgend)
      .end((err, sres) => {
        if (err) {
          console.log('douban error: ', err)
          return next(err);
        }
        let $ = cheerio.load(sres.text);
        const btns = Array.from($('.playBtn')).map(i => $(i))
        if (btns.some(a => a.attr('href').includes('http'))) {
          const links = btns.map(a => ({
            title: a.text(),
            href: interceptUrlFromDouban(a.attr('href'))[0]
          }))
          res.send(
              tpl(links.map(i => `<a href=${i.href}>${i.title}</a>`).join('<br />'))
          );
        } else {
          loadEpisodeList(req, res, next, sres)
        }
      })
  } else {
    res.sendfile(`${__dirname}/index.html`)
  }

  

});

app.get('/choose', (req, res, next) => {
  const line = Number(req.query.line)
  if (line) {
    gLine = Number.isNaN(line) ? 0 : (line % vipPrefixList.length)
    res.send(`线路切换到${line}: ${vipPrefixList[line]}<br/><a href="/">返回首页</a>`)
  } else {
    res.send(
      tpl(vipPrefixList.map((href, index) => `<a href="/choose?line=${index}">线路${index}: ${href}</a>`).join('<br />'))
    )
  }
})


app.listen(9000, () => {
  console.log('app is listening at port 9000');
});
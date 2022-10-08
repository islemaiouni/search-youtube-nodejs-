const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const searchString = "..";                                        // what we want to search (for movie results)
// const searchString = "Red Hot Chili Peppers";                         // what we want to search (for related search results)
// const searchString = "..";                                   // what we want to search (for other results)
const requestParams = {
  baseURL: `https://www.youtube.com`,
  encodedQuery: encodeURI(searchString),                            // what we want to search for in URI encoding
};
async function scrollPage(page, scrollElements) {
  let currentElement = 0;
  while (true) {
    let elementsLength = await page.evaluate((scrollElements) => {
      return document.querySelectorAll(scrollElements).length;
    }, scrollElements);
    for (; currentElement < elementsLength; currentElement++) {
      await page.waitForTimeout(200);
      await page.evaluate(
        (currentElement, scrollElements) => {
          document.querySelectorAll(scrollElements)[currentElement].scrollIntoView();
        },
        currentElement,
        scrollElements
      );
    }
    await page.waitForTimeout(5000);
    let newElementsLength = await page.evaluate((scrollElements) => {
      return document.querySelectorAll(scrollElements).length;
    }, scrollElements);
    if (newElementsLength === elementsLength) break;
  }
}
async function fillMovieDataFromPage(page) {
  const dataFromPage = await page.evaluate((requestParams) => {
    return Array.from(document.querySelectorAll("#contents > ytd-movie-renderer")).map((el) => ({
      title: el.querySelector("a#video-title")?.textContent.trim(),
      link: `${requestParams.baseURL}${el.querySelector("a#thumbnail")?.getAttribute("href")}`,
      channel: {
        name: el.querySelector("#channel-info #channel-name a")?.textContent.trim(),
        link: `${requestParams.baseURL}${el.querySelector("#channel-info #channel-name a")?.getAttribute("href")}`,
      },
      length: el.querySelector("span.ytd-thumbnail-overlay-time-status-renderer")?.textContent.trim(),
      description: el.querySelector("#description-text")?.textContent.trim(),
      info: Array.from(el.querySelectorAll(".movie-metadata-list li")).map((el) => el.textContent.trim()),
      extensions: Array.from(el.querySelectorAll(".text-wrapper > ytd-badge-supported-renderer .badge")).map((el) =>
        el.querySelector("span")?.textContent.trim()
      ),
      thumbnail: el.querySelector("a#thumbnail #img")?.getAttribute("src"),
    }));
  }, requestParams);
  return dataFromPage;
}
async function fillRelatedSearchDataFromPage(page) {
  while (true) {
    const rightArrow = await page.$("#contents > ytd-horizontal-card-list-renderer #right-arrow-container:not([hidden])");
    if (rightArrow) {
      await page.click("#contents > ytd-horizontal-card-list-renderer #right-arrow-container:not([hidden])");
      await page.waitForTimeout(500);
    } else break;
  }
  await page.waitForTimeout(2000);
  const dataFromPage = await page.evaluate((requestParams) => {
    return Array.from(document.querySelectorAll("#contents > ytd-horizontal-card-list-renderer ytd-search-refinement-card-renderer")).map((el) => ({
      query: el.querySelector("#card-title")?.textContent.trim(),
      link: `${requestParams.baseURL}${el.querySelector("a")?.getAttribute("href")}`,
      thumbnail: el.querySelector("#img")?.getAttribute("src"),
    }));
  }, requestParams);
  return dataFromPage;
}
async function fillPlaylistsDataFromPage(page) {
  const dataFromPage = await page.evaluate((requestParams) => {
    const mixes = Array.from(document.querySelectorAll("#contents > ytd-radio-renderer")).map((el) => ({
      title: el.querySelector("a > h3 > #video-title")?.textContent.trim(),
      link: `${requestParams.baseURL}${el.querySelector("a#thumbnail")?.getAttribute("href")}`,
      videos: Array.from(el.querySelectorAll("ytd-child-video-renderer a")).map((el) => ({
        title: el.querySelector("#video-title")?.textContent.trim(),
        link: `${requestParams.baseURL}${el.getAttribute("href")}`,
        length: el.querySelector("#length")?.textContent.trim(),
      })),
      thumbnail: el.querySelector("a#thumbnail #img")?.getAttribute("src"),
    }));
    const playlists = Array.from(document.querySelectorAll("#contents > ytd-playlist-renderer")).map((el) => ({
      title: el.querySelector("a > h3 > #video-title")?.textContent.trim(),
      link: `${requestParams.baseURL}${el.querySelector("a#thumbnail")?.getAttribute("href")}`,
      channel: {
        name: el.querySelector("#channel-name a")?.textContent.trim(),
        link: `${requestParams.baseURL}${el.querySelector("#channel-name a")?.getAttribute("href")}`,
      },
      videoCount: el.querySelector("yt-formatted-string.ytd-thumbnail-overlay-side-panel-renderer")?.textContent.trim(),
      videos: Array.from(el.querySelectorAll("ytd-child-video-renderer a")).map((el) => ({
        title: el.querySelector("#video-title")?.textContent.trim(),
        link: `${requestParams.baseURL}${el.getAttribute("href")}`,
        length: el.querySelector("#length")?.textContent.trim(),
      })),
      thumbnail: el.querySelector("a#thumbnail #img")?.getAttribute("src"),
    }));
    return [...mixes, ...playlists];
  }, requestParams);
  return dataFromPage;
}
async function fillChannelsDataFromPage(page) {
  const dataFromPage = await page.evaluate((requestParams) => {
    return Array.from(document.querySelectorAll("#contents > ytd-channel-renderer")).map((el) => ({
      title: el.querySelector("#channel-title #text")?.textContent.trim(),
      link: `${requestParams.baseURL}${el.querySelector("#avatar-section a")?.getAttribute("href")}`,
      verified: Boolean(el.querySelector("#channel-title .badge")),
      subscribers: el.querySelector("#subscribers")?.textContent.trim(),
      description: el.querySelector("#description")?.textContent.trim(),
      videoCount: el.querySelector("#video-count")?.textContent.trim(),
      thumbnail: el.querySelector("#avatar-section #img")?.getAttribute("src"),
    }));
  }, requestParams);
  return dataFromPage;
}
async function fillCategoriesDataFromPage(page) {
  const dataFromPage = await page.evaluate((requestParams) => {
    return Array.from(document.querySelectorAll("#contents > ytd-shelf-renderer")).reduce(
      (acc, el) => ({
        ...acc,
        [el.querySelector("#title")?.textContent.trim()]: Array.from(el.querySelectorAll("ytd-video-renderer")).map((el) => ({
          title: el.querySelector("a#video-title")?.textContent.trim(),
          link: `${requestParams.baseURL}${el.querySelector("a#thumbnail")?.getAttribute("href")}`,
          channel: {
            name: el.querySelector("#channel-info #channel-name a")?.textContent.trim(),
            link: `${requestParams.baseURL}${el.querySelector("#channel-info > a")?.getAttribute("href")}`,
            thumbnail: el.querySelector("#channel-info > a #img")?.getAttribute("src"),
          },
          publishedDate: el.querySelectorAll("#metadata-line > span")[1]?.textContent.trim(),
          views: el.querySelectorAll("#metadata-line > span")[0]?.textContent.trim(),
          length: el.querySelector("span.ytd-thumbnail-overlay-time-status-renderer")?.textContent.trim(),
          description: el.querySelector(".metadata-snippet-container > yt-formatted-string")?.textContent.trim(),
          extensions: Array.from(el.querySelectorAll("#badges .badge")).map((el) => el.querySelector("span")?.textContent.trim()),
          thumbnail: el.querySelector("a#thumbnail #img")?.getAttribute("src"),
        })),
      }),
      {}
    );
  }, requestParams);
  return dataFromPage;
}

async function getYoutubeSearchResults() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const URL = `${requestParams.baseURL}/results?search_query=${requestParams.encodedQuery}`;
  await page.setDefaultNavigationTimeout(60000);
  await page.goto(URL);
  await page.waitForSelector("#contents > ytd-video-renderer");
  const scrollElements = "#contents > ytd-video-renderer";
  await scrollPage(page, scrollElements);
  await page.waitForTimeout(10000);
  const moviesResults = await fillMovieDataFromPage(page);
  const relatedSearch = await fillRelatedSearchDataFromPage(page);
  const playlists = await fillPlaylistsDataFromPage(page);
  const channels = await fillChannelsDataFromPage(page);
  const categories = await fillCategoriesDataFromPage(page);
 
  await browser.close();
  return { moviesResults, relatedSearch, playlists, channels, categories, ads };
}
getYoutubeSearchResults().then((result) => console.dir(result, { depth: null }));

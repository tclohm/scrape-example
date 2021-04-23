#!/usr/bin/env node
'use strict'

// MARK: -- 3rd party packages
const cheerio = require('cheerio')
const pmap = require('p-map')
const got = require('got')

// MARK: -- node url package
const { resolve } = require('url')

const baseURL = 'https://github.com'

exports.main = async () => {
	const { body } = await got(`https://github.com/trending`)

	const $ = cheerio.load(body)
	const repos = $('.repo-list li').get().map(li => {
		try {
			const $li = $(li)
			const $link = $li.find('h3 a')
			const url = resolve(baseURL, $link.attr('href'))
			const linkText = $link.text()
			const repo = linkText.split('/').map(p => p.trim())
			const desc = $li.find('p').text().trim()

			return {
				url,
				username: repo[0],
				reponame: repo[1],
				desc
			}
		} catch (err) {
			console.error('parsing error', err)
		}
	}).filter(Boolean)

	return (await pmap(repos, processDetailPage, {
		concurrency: 3
	})).filter(Boolean)
}


async function processDetailPage (repo) {
	console.warn('processing repo', repo.url)

	try {
		const { body } = await got(repo.url)
		const $ = cheerio.load(body)
		const numberCommits = parseInt($('.commits span').text().trim().replace(/,/g, ''))

		const [
			numIssues,
			numPRs,
			numProjects
		] = $('.Counter').map((i, el) => parseInt($(el).text().trim())).get()

		const [
			numWatchers,
			numStars,
			numStarsRedundant,
			numForks
		] = $('.social-count').map((i, el) => parseInt($(el).text().trim().replace(/,/g, ''))).get()

		const languages = $('.repository-lang-stats-numbers li').map((i, li) => {
			const $li = $(li)
			const lang = $li.find('.lang').text().trim()
			const percentStr = $li.find('.percent').text().trim().replace('%', '')
			const percent = parseFloat(percentStr)

			return {
				language: lang,
				percent
			}
		}).get()

		return {
			...repo,
			numberCommits,
			numIssues,
			numPRs,
			numProjects,
			numWatchers,
			numStars,
			numForks,
			languages
		}
	} catch (err) {
		console.error(err.message)
	}
}

if (!module.parent) {
	exports.main()
		.then(repos => {
			console.log(JSON.stringify(repos, null, 2))
			process.exit(0)
		}).catch(err => {
			console.error(err)
			process.exit(1)
		})
}
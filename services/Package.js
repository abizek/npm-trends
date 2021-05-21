import { get as _get } from 'lodash';
import hostedGitInfo from 'hosted-git-info';

import { urlWithProxy } from 'utils/proxy';
import { colors } from 'utils/colors';
import Fetch from './Fetch';
import PackageDownloads from './PackageDownloads';

class Package {
  static async fetchPackages(packetNames) {
    // packageNames format: ['react', '@angular-core']
    if (!packetNames) {
      return [];
    }

    const fetchedPackages = await Promise.all(
      packetNames.map(async (packageName) => {
        try {
          return await this.fetchPackage(packageName);
        } catch (e) {
          return {
            hasError: true,
            name: packageName,
          };
        }
      }),
    );

    const isValidPackage = (p) => !p.hasError && p.name;

    const validPackages = fetchedPackages
      .filter((p) => isValidPackage(p))
      .map((p, i) => ({
        ...p,
        color: colors[i],
      }));
    const invalidPackages = fetchedPackages.filter((p) => !isValidPackage(p)).map((p) => p.name);

    return {
      validPackages,
      invalidPackages,
    };
  }

  static formatRepositoryData(npmRepositoryUrl) {
    try {
      const gitInfo = hostedGitInfo.fromUrl(npmRepositoryUrl);

      return {
        type: gitInfo.type,
        url: gitInfo.browse(),
      };
    } catch {
      return {
        type: null,
        url: null,
      };
    }
  }

  static async fetchPackage(packageName) {
    const npmPackageData = await Package.fetchPackageDetails(packageName);

    const repository = this.formatRepositoryData(_get(npmPackageData, 'repository.url', ''));

    const github = repository.type === 'github' ? await this.fetchGithubRepo(repository.url) : null;

    const weeklyDownloads = await PackageDownloads.fetchPoint(npmPackageData.name, 'last-week');

    return {
      id: npmPackageData.name,
      name: npmPackageData.name,
      description: _get(npmPackageData, 'description', ''),
      readme: _get(npmPackageData, 'readme', ''),
      repository,
      links: {
        npm: `https://npmjs.com/package/${npmPackageData.name}`,
        homepage: _get(npmPackageData, 'homepage', ''),
      },
      github,
      downloads: {
        weekly: weeklyDownloads.downloads,
      },
    };
  }

  static async fetchGithubRepo(url) {
    const repositoryPath = url.split('.com')[1].replace('.git', '');

    const githubUrl = `https://api.github.com/repos${repositoryPath}`;

    return Fetch.getJSON(urlWithProxy(githubUrl));
  }

  static async fetchPackageDetails(packetName) {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packetName)}`;

    return Fetch.getJSON(urlWithProxy(url));
  }
}

export default Package;

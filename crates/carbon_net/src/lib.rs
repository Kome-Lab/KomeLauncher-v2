use std::fmt::Display;
use std::sync::atomic::{AtomicU64, Ordering};
use std::{
    path::{Path, PathBuf},
    sync::Arc,
};

use futures::StreamExt;
use reqwest::Client;
use reqwest_middleware::ClientBuilder;
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};

use md5::Md5;
use sha1::Digest as _;
use sha1::Sha1;
use sha2::Sha256;
use tokio::sync::watch;
use tokio::{
    fs::OpenOptions,
    io::{AsyncReadExt, AsyncWriteExt},
};
use tracing::trace;

use error::DownloadError;

mod error;

#[derive(Debug, Clone)]
pub enum Checksum {
    Sha1(String),
    Sha256(String),
    Md5(String),
}

pub trait IntoVecDownloadable {
    fn into_vec_downloadable(self, base_path: &Path) -> Vec<Downloadable>;
}

pub trait IntoDownloadable {
    fn into_downloadable(self, base_path: &Path) -> Downloadable;
}

#[derive(Debug, Clone)]
pub struct Downloadable {
    pub url: String,
    pub path: PathBuf,
    pub checksum: Option<Checksum>,
    pub size: Option<u64>,
}

impl Display for Downloadable {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} -> {}", self.url, self.path.display())
    }
}

impl Downloadable {
    pub fn new(url: impl Into<String>, path: impl AsRef<Path>) -> Self {
        Self {
            url: url.into(),
            path: path.as_ref().into(),
            checksum: None,
            size: None,
        }
    }

    pub fn with_checksum(mut self, checksum: Option<Checksum>) -> Self {
        self.checksum = checksum;
        self
    }

    pub fn with_size(mut self, size: u64) -> Self {
        self.size = Some(size);
        self
    }
}

#[derive(Debug, Default, Clone)]
pub struct Progress {
    pub total_count: u64,
    pub current_count: u64,

    pub total_size: u64,
    pub current_size: u64,
}

impl Progress {
    pub fn new() -> Self {
        Self::default()
    }
}

// Todo: Add checksum/size verification
pub async fn download_file(
    downloadable_file: &Downloadable,
    progress: Option<watch::Sender<Progress>>,
) -> Result<(), DownloadError> {
    let retry_policy = ExponentialBackoff::builder().build_with_max_retries(3);
    let reqwest_client = Client::builder().build()?;
    let client = ClientBuilder::new(reqwest_client)
        .with(RetryTransientMiddleware::new_with_policy(retry_policy))
        .build();

    let mut response = client.get(&downloadable_file.url).send().await?;

    if !response.status().is_success() {
        return Err(DownloadError::Non200StatusCode(
            downloadable_file.clone(),
            response.status().as_u16(),
        ));
    }

    // Ensure the parent directory exists
    if let Some(parent) = downloadable_file.path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&downloadable_file.path)
        .await?;

    let mut buf = vec![];
    while let Some(chunk) = response.chunk().await? {
        file.write_all(&chunk).await?;
        buf.extend_from_slice(&chunk);
        if let Some(progress) = &progress {
            progress.send(Progress {
                // Special case for single file
                total_count: 1,
                current_count: 0,

                current_size: buf.len() as u64,
                total_size: downloadable_file.size.unwrap_or(0),
            })?;
        }
    }

    // Check size and checksum when provided
    if let Some(size) = downloadable_file.size {
        if size != buf.len() as u64 {
            return Err(DownloadError::SizeMismatch {
                expected: size,
                actual: buf.len() as u64,
            });
        }
    }

    if let Some(checksum) = &downloadable_file.checksum {
        match checksum {
            Checksum::Sha1(expected) => {
                let mut hasher = Sha1::new();
                hasher.update(&buf);
                let actual = hasher.finalize();
                let actual = hex::encode(actual);

                if expected != &actual {
                    return Err(DownloadError::ChecksumMismatch {
                        expected: expected.clone(),
                        actual,
                        url: downloadable_file.url.clone(),
                        path: downloadable_file.path.display().to_string(),
                    });
                }
            }
            Checksum::Sha256(expected) => {
                let mut hasher = Sha256::new();
                hasher.update(&buf);
                let actual = hasher.finalize();
                let actual = hex::encode(actual);

                if expected != &actual {
                    return Err(DownloadError::ChecksumMismatch {
                        expected: expected.clone(),
                        actual,
                        url: downloadable_file.url.clone(),
                        path: downloadable_file.path.display().to_string(),
                    });
                }
            }
            Checksum::Md5(expected) => {
                let mut hasher = Md5::new();
                hasher.update(&buf);
                let actual = hasher.finalize();
                let actual = hex::encode(actual);

                if expected != &actual {
                    return Err(DownloadError::ChecksumMismatch {
                        expected: expected.clone(),
                        actual,
                        url: downloadable_file.url.clone(),
                        path: downloadable_file.path.display().to_string(),
                    });
                }
            }
        }
    }

    if let Some(progress) = &progress {
        progress.send(Progress {
            total_count: 1,
            current_count: 1,

            current_size: buf.len() as u64,
            total_size: downloadable_file.size.unwrap_or(0),
        })?;
    }

    Ok(())
}

// TODO: improve checksum/size verification
pub async fn download_multiple(
    files: &[Downloadable],
    progress: Option<watch::Sender<Progress>>,
    concurrency: usize,
    deep_check: bool,
    skip_download: bool,
) -> Result<bool, DownloadError> {
    let retry_policy = ExponentialBackoff::builder().build_with_max_retries(3);
    let reqwest_client = Client::builder().build().unwrap();
    let client = ClientBuilder::new(reqwest_client)
        .with(RetryTransientMiddleware::new_with_policy(retry_policy))
        .build();

    let downloads = Arc::new(tokio::sync::Semaphore::new(concurrency));

    let mut tasks: Vec<(tokio::task::JoinHandle<Result<_, DownloadError>>, String)> = vec![];

    let arced_progress = Arc::new(progress);

    let progress_counter = Arc::new(AtomicU64::new(0));
    let file_counter = Arc::new(AtomicU64::new(0));
    let total_size = Arc::new(AtomicU64::new(files.iter().filter_map(|f| f.size).sum()));

    let total_count = files.len() as u64;

    for file in files {
        let semaphore = Arc::clone(&downloads);
        let progress = Arc::clone(&arced_progress);
        let progress_counter = Arc::clone(&progress_counter);
        let file_counter = Arc::clone(&file_counter);
        let size = Arc::clone(&total_size);
        let url = file.url.clone();
        let url_clone = file.url.clone();
        let path = file.path.clone();
        let client = client.clone();

        let file = file.clone();
        let task = tokio::spawn(async move {
            let _permit = semaphore
                .acquire()
                .await
                .map_err(|err| DownloadError::GenericDownload(err.to_string()))?;
            let path = path.clone();
            let url = url.clone();

            let file_looks_good = match file.size {
                Some(size) if path.exists() => {
                    let metadata = tokio::fs::metadata(&path).await;
                    if let Ok(metadata) = metadata {
                        metadata.len() == size
                    } else {
                        false
                    }
                }
                Some(_) => false,
                None => path.exists(),
            };

            if file_looks_good {
                if deep_check {
                    // verify if file exists and checksum matches
                    let mut sha1 = Sha1::new();
                    let mut sha256 = Sha256::new();
                    let mut md5 = Md5::new();

                    let mut fs_file = tokio::fs::File::open(&path).await?;

                    let mut buf = vec![];
                    fs_file.read_to_end(&mut buf).await?;

                    match file.checksum {
                        Some(Checksum::Sha1(_)) => sha1.update(&buf),
                        Some(Checksum::Sha256(_)) => sha256.update(&buf),
                        Some(Checksum::Md5(_)) => md5.update(&buf),
                        None => {}
                    }

                    match file.checksum {
                        Some(Checksum::Sha1(ref hash)) => {
                            let finalized = sha1.finalize();
                            if hash == &format!("{finalized:x}") {
                                // unwraps will be fine because file_looks_good can't happen without it
                                let downloaded = progress_counter
                                    .fetch_add(file.size.unwrap(), Ordering::SeqCst);

                                if let Some(progress) = &*progress {
                                    progress.send(Progress {
                                        current_count: file_counter.load(Ordering::SeqCst),
                                        total_count,
                                        current_size: downloaded,
                                        total_size: size.load(Ordering::SeqCst),
                                    })?;
                                }

                                return Ok(false);
                            } else {
                                trace!(
                                    "Hash mismatch sha1 for file: {} - expected: {hash} - got: {}",
                                    path.display(),
                                    &format!("{finalized:x}")
                                );
                            }
                        }
                        Some(Checksum::Sha256(ref hash)) => {
                            let finalized = sha256.finalize();
                            if hash == &format!("{finalized:x}") {
                                // unwraps will be fine because file_looks_good can't happen without it
                                let downloaded = progress_counter
                                    .fetch_add(file.size.unwrap(), Ordering::SeqCst);

                                if let Some(progress) = &*progress {
                                    progress.send(Progress {
                                        current_count: file_counter.load(Ordering::SeqCst),
                                        total_count,
                                        current_size: downloaded,
                                        total_size: size.load(Ordering::SeqCst),
                                    })?;
                                }

                                return Ok(false);
                            } else {
                                trace!(
                                        "Hash mismatch sha256 for file: {} - expected: {hash} - got: {}",
                                        path.display(),
                                        &format!("{finalized:x}")
                                    );
                            }
                        }
                        Some(Checksum::Md5(ref hash)) => {
                            let finalized = md5.finalize();
                            if hash == &format!("{finalized:x}") {
                                // unwraps will be fine because file_looks_good can't happen without it
                                let downloaded = progress_counter
                                    .fetch_add(file.size.unwrap(), Ordering::SeqCst);

                                if let Some(progress) = &*progress {
                                    progress.send(Progress {
                                        current_count: file_counter.load(Ordering::SeqCst),
                                        total_count,
                                        current_size: downloaded,
                                        total_size: size.load(Ordering::SeqCst),
                                    })?;
                                }

                                return Ok(false);
                            } else {
                                trace!(
                                    "Hash mismatch md5 for file: {} - expected: {hash} - got: {}",
                                    path.display(),
                                    &format!("{finalized:x}")
                                );
                            }
                        }
                        None => {}
                    }
                } else {
                    return Ok(false);
                }
            } else if skip_download {
                return Ok(true);
            }

            let mut file_downloaded = 0u64;
            let mut file_size_reported = file.size.unwrap_or(0);

            let resp = client.get(&url).send().await?;

            if !resp.status().is_success() {
                return Err(DownloadError::Non200StatusCode(
                    file.clone(),
                    resp.status().as_u16(),
                ));
            }

            let mut resp_stream = resp.bytes_stream();
            tokio::fs::create_dir_all(path.parent().ok_or(DownloadError::GenericDownload(
                "Can't create folder".to_owned(),
            ))?)
            .await?;

            let mut sha1 = Sha1::new();
            let mut sha256 = Sha256::new();
            let mut md5 = Md5::new();

            let mut fs_file = OpenOptions::new()
                .create(!path.exists())
                .write(true)
                .truncate(path.exists())
                .open(&path)
                .await?;

            while let Some(item) = resp_stream.next().await {
                let res = item?;
                match file.checksum {
                    Some(Checksum::Sha1(_)) => sha1.update(&res),
                    Some(Checksum::Sha256(_)) => sha256.update(&res),
                    Some(Checksum::Md5(_)) => md5.update(&res),
                    None => {}
                }

                tokio::io::copy(&mut res.as_ref(), &mut fs_file).await?;

                let downloaded = progress_counter.fetch_add(res.len() as u64, Ordering::SeqCst);
                file_downloaded += res.len() as u64;

                if file_downloaded > file_size_reported {
                    let diff = file_downloaded - file_size_reported;
                    file_size_reported = file_downloaded;
                    size.fetch_add(diff, Ordering::SeqCst);
                }

                if let Some(progress) = &*progress {
                    progress.send(Progress {
                        current_count: file_counter.load(Ordering::SeqCst),
                        total_count,
                        current_size: downloaded,
                        total_size: size.load(Ordering::SeqCst),
                    })?;
                }
            }

            let diff = file_size_reported - file_downloaded;
            let total = progress_counter.fetch_sub(diff, Ordering::SeqCst) - diff;

            if let Some(progress) = &*progress {
                progress.send(Progress {
                    current_count: file_counter.fetch_add(1, Ordering::SeqCst),
                    total_count,
                    current_size: total,
                    total_size: size.load(Ordering::SeqCst),
                })?;
            }

            match file.checksum {
                Some(Checksum::Sha1(expected_hash)) => {
                    let actual_hash = hex::encode(sha1.finalize().as_slice());

                    if expected_hash != actual_hash {
                        tracing::error!(
                            "Checksum mismatch for file: {} - expected: {} - got: {}",
                            path.display(),
                            expected_hash,
                            actual_hash
                        );

                        return Err(DownloadError::ChecksumMismatch {
                            expected: expected_hash,
                            actual: actual_hash,
                            url: url,
                            path: path.display().to_string(),
                        });
                    }
                }
                Some(Checksum::Sha256(expected_hash)) => {
                    let actual_hash = hex::encode(sha256.finalize().as_slice());

                    if expected_hash != actual_hash {
                        tracing::error!(
                            "Checksum mismatch for file: {} - expected: {} - got: {}",
                            path.display(),
                            expected_hash,
                            actual_hash
                        );

                        return Err(DownloadError::ChecksumMismatch {
                            expected: expected_hash,
                            actual: actual_hash,
                            url: url,
                            path: path.display().to_string(),
                        });
                    }
                }
                Some(Checksum::Md5(expected_hash)) => {
                    let actual_hash = hex::encode(md5.finalize().as_slice());

                    if expected_hash != actual_hash {
                        tracing::error!(
                            "Checksum mismatch for file: {} - expected: {} - got: {}",
                            path.display(),
                            expected_hash,
                            actual_hash
                        );

                        return Err(DownloadError::ChecksumMismatch {
                            expected: expected_hash,
                            actual: actual_hash,
                            url: url,
                            path: path.display().to_string(),
                        });
                    }
                }
                None => {}
            }

            Ok(true)
        });

        tasks.push((task, url_clone));
    }

    let mut download_required = false;
    for (task, url) in tasks {
        match task.await? {
            Ok(download_req) => {
                download_required |= download_req;
            }
            Err(e) => {
                tracing::error!({ error = ?e }, "Download failed for {}", url);
                return Err(e);
            }
        }
    }

    Ok(download_required)
}

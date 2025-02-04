use std::sync::Arc;

use markdown::{CompileOptions, Options};
use reqwest_middleware::ClientWithMiddleware;
use serde::Serialize;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::managers::GDL_API_BASE;

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ConsentType {
    Metrics,
    TermsAndPrivacy,
}

pub struct TermsAndPrivacy {
    http_client: ClientWithMiddleware,
}

impl TermsAndPrivacy {
    pub fn new(http_client: ClientWithMiddleware) -> Self {
        Self { http_client }
    }

    #[tracing::instrument(skip(self, secret))]
    pub async fn record_consent<'b>(
        &self,
        consent_type: ConsentType,
        consented: bool,
        user_id: &'b Uuid,
        secret: &'b Vec<u8>,
    ) -> anyhow::Result<String> {
        tracing::info!("Recording consent");

        #[derive(Debug, Serialize)]
        pub struct Body<'c> {
            pub user_id: &'c Uuid,
            pub secret: &'c Vec<u8>,
            pub consent_type: ConsentType,
            pub consented: bool,
        }

        let consent_url = format!("{}/v1/record_consent", GDL_API_BASE);
        let body = Body {
            secret,
            user_id,
            consent_type,
            consented,
        };

        let resp = self.http_client.post(&consent_url).json(&body).send().await;

        let accepted_sha = match resp {
            Ok(res) => {
                if res.status().is_success() {
                    tracing::info!("Consent recorded successfully");

                    let sha = res.text().await?;
                    tracing::info!("Accepted sha: {}", sha);

                    sha
                } else {
                    tracing::error!("Failed to record consent: {:?}", res);
                    return Err(anyhow::anyhow!("Failed to record consent"));
                }
            }
            Err(e) => {
                tracing::error!("Failed to record consent: {:?}", e);
                return Err(anyhow::anyhow!("Failed to record consent"));
            }
        };

        Ok(accepted_sha)
    }

    pub async fn fetch_terms_of_service_body(&self) -> anyhow::Result<String> {
        let response = self
            .http_client
            .get(format!("{}/v1/terms_of_service_md", GDL_API_BASE,))
            .send()
            .await?
            .text()
            .await?;

        Ok(parse_markdown_document(&response))
    }

    pub async fn fetch_privacy_statement_body(&self) -> anyhow::Result<String> {
        let response = self
            .http_client
            .get(format!("{}/v1/privacy_statement_md", GDL_API_BASE,))
            .send()
            .await?
            .text()
            .await?;

        Ok(parse_markdown_document(&response))
    }

    pub async fn get_latest_consent_sha() -> anyhow::Result<String> {
        let client = crate::iridium_client::get_client().build();

        let url = format!("{}/v1/latest_consent_checksum", GDL_API_BASE);

        let latest_consent_sha = client.get(&url).send().await?.text().await?;

        tracing::info!("Latest consent sha: {}", latest_consent_sha);

        Ok(latest_consent_sha)
    }
}

fn parse_markdown_document(markdown: &str) -> String {
    markdown::to_html_with_options(
        markdown,
        &Options {
            compile: CompileOptions {
                allow_dangerous_html: true,
                ..CompileOptions::gfm()
            },
            ..Options::gfm()
        },
    )
    .expect("This is guaranteed to work with gfm")
}

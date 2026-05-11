/**
 * macOS LaunchServices integration — read and set the default app registered
 * to open a content type (UTI). We use this so the user can make FullMark
 * the default .md handler without leaving the app.
 *
 * Non-macOS targets get stubs that return an error, since LaunchServices is
 * Apple-specific.
 */

#[cfg(target_os = "macos")]
mod imp {
    use core_foundation::base::TCFType;
    use core_foundation::string::{CFString, CFStringRef};

    const BUNDLE_ID: &str = "app.fullmark.desktop";

    /// UTIs that `.md` (and friends) get associated with on macOS. We set the
    /// default for all of them so right-clicking any flavor of markdown picks
    /// FullMark.
    const MARKDOWN_UTIS: &[&str] = &[
        "net.daringfireball.markdown",
        "public.markdown",
    ];

    // LSRoleAll — accept any role (viewer / editor / shell / etc.)
    const K_LS_ROLES_ALL: u32 = 0xFFFFFFFF;

    #[link(name = "CoreServices", kind = "framework")]
    extern "C" {
        fn LSSetDefaultRoleHandlerForContentType(
            in_content_type: CFStringRef,
            in_role: u32,
            in_handler_bundle_id: CFStringRef,
        ) -> i32;

        fn LSCopyDefaultRoleHandlerForContentType(
            in_content_type: CFStringRef,
            in_role: u32,
        ) -> CFStringRef;
    }

    pub fn set_default_markdown_handler() -> Result<(), String> {
        let bundle_id = CFString::new(BUNDLE_ID);
        let mut last_status: i32 = 0;
        let mut any_ok = false;
        for uti in MARKDOWN_UTIS {
            let uti_cf = CFString::new(uti);
            let status = unsafe {
                LSSetDefaultRoleHandlerForContentType(
                    uti_cf.as_concrete_TypeRef(),
                    K_LS_ROLES_ALL,
                    bundle_id.as_concrete_TypeRef(),
                )
            };
            if status == 0 {
                any_ok = true;
            } else {
                last_status = status;
            }
        }
        if any_ok {
            Ok(())
        } else {
            Err(format!(
                "LSSetDefaultRoleHandlerForContentType failed (status {last_status})"
            ))
        }
    }

    pub fn get_default_markdown_handler() -> Result<Option<String>, String> {
        // Query the first UTI; the answer is the bundle ID currently handling .md
        let uti_cf = CFString::new(MARKDOWN_UTIS[0]);
        let result_ref = unsafe {
            LSCopyDefaultRoleHandlerForContentType(
                uti_cf.as_concrete_TypeRef(),
                K_LS_ROLES_ALL,
            )
        };
        if result_ref.is_null() {
            return Ok(None);
        }
        let cf = unsafe { CFString::wrap_under_create_rule(result_ref) };
        Ok(Some(cf.to_string()))
    }

    pub fn is_default_markdown_handler() -> bool {
        get_default_markdown_handler()
            .ok()
            .flatten()
            .map(|id| id.eq_ignore_ascii_case(BUNDLE_ID))
            .unwrap_or(false)
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    pub fn set_default_markdown_handler() -> Result<(), String> {
        Err("Setting the default handler is only supported on macOS".to_string())
    }
    pub fn get_default_markdown_handler() -> Result<Option<String>, String> {
        Ok(None)
    }
    pub fn is_default_markdown_handler() -> bool {
        false
    }
}

#[tauri::command]
pub fn set_default_markdown_handler() -> Result<(), String> {
    imp::set_default_markdown_handler()
}

#[tauri::command]
pub fn get_default_markdown_handler() -> Result<Option<String>, String> {
    imp::get_default_markdown_handler()
}

#[tauri::command]
pub fn is_default_markdown_handler() -> bool {
    imp::is_default_markdown_handler()
}

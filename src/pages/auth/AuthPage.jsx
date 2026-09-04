import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { 
  Mail, 
  Lock, 
  User, 
  GraduationCap, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { LogoBadge } from '../../components/common';
import './AuthPage.css';

export const AuthPage = () => {
  const navigate = useNavigate();
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();

  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sign In Form State
  const [signInData, setSignInData] = useState({
    email: '',
    password: '',
  });

  // Sign Up Form State
  const [signUpData, setSignUpData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'student', // 'student' | 'tutor'
  });

  const handleSignInChange = (e) => {
    setSignInData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    if (errorMsg) setErrorMsg('');
  };

  const handleSignUpChange = (e) => {
    setSignUpData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    if (errorMsg) setErrorMsg('');
  };

  // Google OAuth Handler via Clerk
  const handleOAuth = async (provider) => {
    if (provider === 'google') {
      try {
        setLoading(true);
        setErrorMsg('');

        if (isActive) {
          if (!isSignUpLoaded) return;
          await signUp.authenticateWithRedirect({
            strategy: 'oauth_google',
            redirectUrl: '/sso-callback',
            redirectUrlComplete: '/',
          });
        } else {
          if (!isSignInLoaded) return;
          await signIn.authenticateWithRedirect({
            strategy: 'oauth_google',
            redirectUrl: '/sso-callback',
            redirectUrlComplete: '/',
          });
        }
      } catch (err) {
        console.error('Google OAuth error:', err);
        setErrorMsg(err.errors?.[0]?.message || err.message || 'Lỗi khi đăng nhập bằng Google');
        setLoading(false);
      }
    }
  };

  // Handle Sign In
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!signInData.email || !signInData.password) {
      setErrorMsg('Vui lòng nhập đầy đủ Email và Mật khẩu');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');

      if (signIn && isSignInLoaded) {
        const result = await signIn.create({
          identifier: signInData.email.trim(),
          password: signInData.password,
        });

        if (result.status === 'complete') {
          setSuccessMsg('Đăng nhập thành công! Đang chuyển hướng...');
          setTimeout(() => navigate('/'), 800);
          return;
        }
      }

      // Fallback Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email: signInData.email.trim(),
        password: signInData.password,
      });
      if (error) throw error;
      setSuccessMsg('Đăng nhập thành công! Đang chuyển hướng...');
      setTimeout(() => navigate('/'), 800);
    } catch (err) {
      setErrorMsg(err.errors?.[0]?.message || err.message || 'Email hoặc mật khẩu không chính xác');
    } finally {
      setLoading(false);
    }
  };

  // Handle Sign Up
  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!signUpData.fullName || !signUpData.email || !signUpData.password) {
      setErrorMsg('Vui lòng điền đầy đủ các trường thông tin');
      return;
    }

    if (signUpData.password.length < 6) {
      setErrorMsg('Mật khẩu cần tối thiểu 6 ký tự');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');

      if (signUp && isSignUpLoaded) {
        const result = await signUp.create({
          emailAddress: signUpData.email.trim(),
          password: signUpData.password,
          firstName: signUpData.fullName.trim(),
        });

        if (result.status === 'complete') {
          setSuccessMsg('Đăng ký thành công!');
          setTimeout(() => navigate('/'), 800);
          return;
        } else {
          setSuccessMsg('Vui lòng kiểm tra email để xác nhận tài khoản!');
          return;
        }
      }

      const { error } = await supabase.auth.signUp({
        email: signUpData.email.trim(),
        password: signUpData.password,
        options: {
          data: {
            full_name: signUpData.fullName.trim(),
            role: signUpData.role,
          },
        },
      });

      if (error) throw error;
      setSuccessMsg('Đăng ký thành công! Vui lòng kiểm tra email xác thực hoặc đăng nhập.');
      setTimeout(() => setIsActive(false), 1500);
    } catch (err) {
      setErrorMsg(err.errors?.[0]?.message || err.message || 'Đăng ký không thành công. Vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      {/* Return to Home button */}
      <Link to="/" className="auth-home-btn">
        <ArrowLeft size={16} /> Trang chủ
      </Link>

      {/* Main Sliding Card */}
      <div className={`auth-card-container ${isActive ? 'active' : ''}`} id="authContainer">
        
        {/* Sign Up Form Panel */}
        <div className={`auth-form-panel auth-sign-up ${isActive ? 'active-mobile' : ''}`}>
          <form onSubmit={handleSignUp}>
            <div className="mobile-toggle-header">
              <button 
                type="button" 
                className={`mobile-toggle-tab ${!isActive ? 'active' : ''}`}
                onClick={() => setIsActive(false)}
              >
                Đăng nhập
              </button>
              <button 
                type="button" 
                className={`mobile-toggle-tab ${isActive ? 'active' : ''}`}
                onClick={() => setIsActive(true)}
              >
                Đăng ký
              </button>
            </div>

            <h1>Tạo Tài Khoản</h1>
            <p className="subtext">Tham gia cộng đồng học tập & giảng dạy LearnMate</p>

            <button type="button" className="auth-google-btn" onClick={() => handleOAuth('google')}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                <path fill="#FBBC05" d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7 0-1.2.2-2 .4-2.7L1.9 6.4C.7 8.8 0 10.8 0 12s.7 3.2 1.9 5.6l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.3L1.9 16c1.8 3.8 5.6 7 10.1 7z"/>
              </svg>
              <span>Đăng ký bằng Google</span>
            </button>

            <div className="auth-divider">
              <span>hoặc sử dụng Email</span>
            </div>

            {errorMsg && isActive && (
              <div className="auth-alert auth-alert-error">
                <AlertCircle size={16} /> <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && isActive && (
              <div className="auth-alert auth-alert-success">
                <CheckCircle2 size={16} /> <span>{successMsg}</span>
              </div>
            )}

            <div className="auth-input-group">
              <User size={18} />
              <input 
                type="text" 
                name="fullName"
                placeholder="Họ và tên" 
                value={signUpData.fullName}
                onChange={handleSignUpChange}
                required
              />
            </div>

            <div className="auth-input-group">
              <Mail size={18} />
              <input 
                type="email" 
                name="email"
                placeholder="Địa chỉ Email" 
                value={signUpData.email}
                onChange={handleSignUpChange}
                required
              />
            </div>

            <div className="auth-input-group">
              <Lock size={18} />
              <input 
                type="password" 
                name="password"
                placeholder="Mật khẩu (tối thiểu 6 ký tự)" 
                value={signUpData.password}
                onChange={handleSignUpChange}
                required
              />
            </div>

            <div className="auth-input-group">
              <GraduationCap size={18} />
              <select 
                name="role"
                value={signUpData.role}
                onChange={handleSignUpChange}
              >
                <option value="student">Vai trò: Học sinh / Học viên</option>
                <option value="tutor">Vai trò: Gia sư / Giáo viên</option>
              </select>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Đang tạo tài khoản...</>
              ) : (
                'Đăng Ký'
              )}
            </button>
          </form>
        </div>

        {/* Sign In Form Panel */}
        <div className={`auth-form-panel auth-sign-in ${!isActive ? 'active-mobile' : ''}`}>
          <form onSubmit={handleSignIn}>
            <div className="mobile-toggle-header">
              <button 
                type="button" 
                className={`mobile-toggle-tab ${!isActive ? 'active' : ''}`}
                onClick={() => setIsActive(false)}
              >
                Đăng nhập
              </button>
              <button 
                type="button" 
                className={`mobile-toggle-tab ${isActive ? 'active' : ''}`}
                onClick={() => setIsActive(true)}
              >
                Đăng ký
              </button>
            </div>

            <h1>Đăng Nhập</h1>
            <p className="subtext">Nhập thông tin tài khoản để truy cập hệ thống</p>

            <button type="button" className="auth-google-btn" onClick={() => handleOAuth('google')}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                <path fill="#FBBC05" d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7 0-1.2.2-2 .4-2.7L1.9 6.4C.7 8.8 0 10.8 0 12s.7 3.2 1.9 5.6l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.3L1.9 16c1.8 3.8 5.6 7 10.1 7z"/>
              </svg>
              <span>Đăng nhập bằng Google</span>
            </button>

            <div className="auth-divider">
              <span>hoặc dùng Email & Mật khẩu</span>
            </div>

            {errorMsg && !isActive && (
              <div className="auth-alert auth-alert-error">
                <AlertCircle size={16} /> <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && !isActive && (
              <div className="auth-alert auth-alert-success">
                <CheckCircle2 size={16} /> <span>{successMsg}</span>
              </div>
            )}

            <div className="auth-input-group">
              <Mail size={18} />
              <input 
                type="email" 
                name="email"
                placeholder="Địa chỉ Email" 
                value={signInData.email}
                onChange={handleSignInChange}
                required
              />
            </div>

            <div className="auth-input-group">
              <Lock size={18} />
              <input 
                type="password" 
                name="password"
                placeholder="Mật khẩu" 
                value={signInData.password}
                onChange={handleSignInChange}
                required
              />
            </div>

            <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Vui lòng liên hệ quản trị viên để đặt lại mật khẩu.'); }} className="auth-link">
              Quên mật khẩu?
            </a>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Đang đăng nhập...</>
              ) : (
                'Đăng Nhập'
              )}
            </button>
          </form>
        </div>

        {/* Dynamic Sliding Overlay Panel */}
        <div className="auth-toggle-container">
          <div className="auth-toggle">
            
            {/* Left Panel (Shows when Sign Up is active -> Click to switch to Sign In) */}
            <div className="auth-toggle-panel auth-toggle-left">
              <LogoBadge boxSize={48} iconSize={30} background="rgba(255, 255, 255, 0.2)" iconColor="#ffffff" style={{ marginBottom: '12px', border: '1px solid rgba(255, 255, 255, 0.3)' }} />
              <h1>Chào Mừng Trở Lại!</h1>
              <p>Đã có tài khoản LearnMate? Đăng nhập ngay để tiếp tục bài giảng và lớp học của bạn.</p>
              <button 
                type="button" 
                className="ghost-btn" 
                id="login"
                onClick={() => {
                  setIsActive(false);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
              >
                Đăng Nhập
              </button>
            </div>

            {/* Right Panel (Shows when Sign In is active -> Click to switch to Sign Up) */}
            <div className="auth-toggle-panel auth-toggle-right">
              <LogoBadge boxSize={48} iconSize={30} background="rgba(255, 255, 255, 0.2)" iconColor="#ffffff" style={{ marginBottom: '12px', border: '1px solid rgba(255, 255, 255, 0.3)' }} />
              <h1>Xin Chào Bạn Mới!</h1>
              <p>Đăng ký tài khoản để bắt đầu hành trình dạy & học thông minh cùng sổ gia sư điện tử.</p>
              <button 
                type="button" 
                className="ghost-btn" 
                id="register"
                onClick={() => {
                  setIsActive(true);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
              >
                Đăng Ký
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

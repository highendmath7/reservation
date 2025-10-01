import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const TeacherPaymentCalculator = () => {
  const [activeTab, setActiveTab] = useState('register');
  const [teachers, setTeachers] = useState([]);
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [newTeacher, setNewTeacher] = useState({ name: '', campus: '' });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [calculationResult, setCalculationResult] = useState(null);
  const [teacherListLoaded, setTeacherListLoaded] = useState(false);
  const [selectedYear, setSelectedYear] = useState('2025');
  const [selectedMonth, setSelectedMonth] = useState('09');

  const CAMPUS_OPTIONS = ['1관', '2관', '3관', '5관'];
  const YEARS = Array.from({ length: 11 }, (_, i) => (2025 + i).toString());
  const MONTHS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));

  const loadTeachersFromFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      Papa.parse(content, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const validTeachers = results.data
            .filter(row => row && row[0] && row[0].trim() && row[1] && row[1].trim())
            .map((row, idx) => {
              let campus = row[1].trim();
              if (!campus.includes('관')) {
                campus = campus + '관';
              }
              return {
                id: Date.now() + idx,
                name: row[0].trim(),
                campus: campus
              };
            });

          if (validTeachers.length > 0) {
            setTeachers(validTeachers);
            setTeacherListLoaded(true);
            alert(`${validTeachers.length}명의 강사가 로드되었습니다.`);
          } else {
            alert('유효한 강사 데이터가 없습니다.');
          }
        },
        error: (error) => {
          alert('CSV 파일 읽기 실패: ' + error.message);
        }
      });
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleTeacherListUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      loadTeachersFromFile(file);
    }
  };

  const exportTeacherList = () => {
    if (teachers.length === 0) {
      alert('등록된 강사가 없습니다.');
      return;
    }
    const rows = teachers.map(t => [t.name, t.campus.replace('관', '')]);
    const csvContent = rows.map(row => row.join(',')).join('\n');
    
    console.log('Teacher List CSV:', csvContent);
    alert('강사목록이 콘솔에 출력되었습니다. 개발자 도구(F12)에서 확인하세요.');
  };

  const handleAddTeacher = () => {
    if (!newTeacher.name || !newTeacher.campus) {
      alert('이름과 관을 모두 선택해주세요.');
      return;
    }
    setShowAddDialog(true);
  };

  const confirmAddTeacher = () => {
    const updatedTeachers = [...teachers, { ...newTeacher, id: Date.now() }];
    setTeachers(updatedTeachers);
    setNewTeacher({ name: '', campus: '' });
    setShowAddDialog(false);
  };

  const handleDeleteTeachers = () => {
    if (selectedTeachers.length === 0) {
      alert('삭제할 강사를 선택해주세요.');
      return;
    }
    setShowDeleteDialog(true);
  };

  const confirmDeleteTeachers = () => {
    const updatedTeachers = teachers.filter(t => !selectedTeachers.includes(t.id));
    setTeachers(updatedTeachers);
    setSelectedTeachers([]);
    setShowDeleteDialog(false);
  };

  const toggleTeacherSelection = (id) => {
    setSelectedTeachers(prev =>
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(files);
  };

  const processFiles = async () => {
    if (!teacherListLoaded || teachers.length === 0) {
      alert('강사목록을 먼저 불러와주세요!');
      return;
    }

    if (uploadedFiles.length === 0) {
      alert('파일을 업로드해주세요.');
      return;
    }

    const dataDict = {};
    teachers.forEach(teacher => {
      if (!dataDict[teacher.campus]) {
        dataDict[teacher.campus] = {};
      }
      if (!dataDict[teacher.campus][teacher.name]) {
        dataDict[teacher.campus][teacher.name] = {};
      }
    });

    for (const file of uploadedFiles) {
      const fileName = file.name;
      const campusMatch = fileName.match(/(\d+)관/);
      if (!campusMatch) continue;

      const campus = campusMatch[1] + '관';
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const isUnpaidList = fileName.includes('미납') || fileName.toLowerCase().includes('unpaid');
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < (isUnpaidList ? 9 : 10)) continue;

        // C열: 청구 년월 (예: "2025년09월")
        const billingYearMonth = String(row[2] || '').trim();
        const yearMonthMatch = billingYearMonth.match(/(\d{4})년(\d{2})월/);
        
        // 선택한 년월과 일치하는지 확인
        if (!yearMonthMatch || yearMonthMatch[1] !== selectedYear || yearMonthMatch[2] !== selectedMonth) {
          continue; // 선택한 년월이 아니면 스킵
        }

        const raw = String(row[0] || '').trim();
        
        const tIndex = raw.indexOf('T');
        if (tIndex === -1) continue;
        
        const teacherName = raw.substring(0, tIndex).trim();
        const className = raw.substring(tIndex + 1).trim();

        const studentName = String(row[1] || '').trim();

        const amount = parseInt(row[isUnpaidList ? 8 : 9]) || 0;

        if (!teacherName || !className || !studentName) continue;

        if (dataDict[campus] && dataDict[campus][teacherName]) {
          if (!dataDict[campus][teacherName][className]) {
            dataDict[campus][teacherName][className] = {};
          }

          let finalAmount = amount;

          if (teacherName === '이용국' && className.includes('N수생')) {
            finalAmount = 95500;
          }

          dataDict[campus][teacherName][className][studentName] = finalAmount;
        }
      }
    }

    const specialStudents = ['황지훈', '조원우', '박종건', '이승찬', '김지호', '전지은'];
    Object.keys(dataDict).forEach(campus => {
      if (dataDict[campus]['안인숙']) {
        Object.keys(dataDict[campus]['안인숙']).forEach(className => {
          const students = dataDict[campus]['안인숙'][className];
          let specialCount = 0;
          let normalCount = 0;

          Object.keys(students).forEach(studentName => {
            if (specialStudents.includes(studentName)) {
              specialCount++;
            } else {
              normalCount++;
            }
          });

          dataDict[campus]['안인숙'][className]['_specialInfo'] = {
            sixtyPercent: specialCount,
            fiftyPercent: normalCount
          };
        });
      }
    });

    const result = {};
    Object.keys(dataDict).forEach(campus => {
      result[campus] = {};
      Object.keys(dataDict[campus]).forEach(teacher => {
        result[campus][teacher] = {};
        Object.keys(dataDict[campus][teacher]).forEach(className => {
          const students = dataDict[campus][teacher][className];
          const studentCount = Object.keys(students).filter(k => k !== '_specialInfo').length;
          const totalAmount = Object.keys(students)
            .filter(k => k !== '_specialInfo')
            .reduce((sum, student) => sum + students[student], 0);

          result[campus][teacher][className] = {
            studentCount,
            totalAmount,
            specialInfo: students._specialInfo || null
          };
        });
      });
    });

    setCalculationResult(result);
  };

  const copyTeacherData = (campus, teacher) => {
    const data = calculationResult[campus][teacher];
    let text = `${teacher} 선생님 (${campus})\n\n`;
    
    Object.keys(data).forEach(className => {
      const classData = data[className];
      const studentInfo = classData.specialInfo
        ? `60%: ${classData.specialInfo.sixtyPercent}명, 50%: ${classData.specialInfo.fiftyPercent}명`
        : `${classData.studentCount}명`;
      
      text += `${className}\t${studentInfo}\t${classData.totalAmount.toLocaleString()}원\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
      alert('복사되었습니다!');
    }).catch(() => {
      alert('복사 실패. 다시 시도해주세요.');
    });
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px'
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto',
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }}>
        <h1 style={{ 
          margin: '0',
          padding: '30px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontSize: '28px',
          fontWeight: '700',
          textAlign: 'center',
          letterSpacing: '-0.5px'
        }}>
          💰 선생님별 이액 계산 프로그램
        </h1>

        <div style={{ 
          display: 'flex',
          background: '#f8f9fa',
          borderBottom: '2px solid #e9ecef'
        }}>
          <button
            onClick={() => setActiveTab('register')}
            style={{
              flex: 1,
              padding: '18px 20px',
              border: 'none',
              background: activeTab === 'register' ? 'white' : 'transparent',
              color: activeTab === 'register' ? '#667eea' : '#6c757d',
              cursor: 'pointer',
              fontWeight: activeTab === 'register' ? '700' : '500',
              fontSize: '16px',
              transition: 'all 0.3s ease',
              borderBottom: activeTab === 'register' ? '3px solid #667eea' : 'none',
              position: 'relative',
              top: activeTab === 'register' ? '2px' : '0'
            }}
          >
            👥 강사 등록
          </button>
          <button
            onClick={() => {
              if (!teacherListLoaded || teachers.length === 0) {
                alert('강사목록을 먼저 불러와주세요!');
                return;
              }
              setActiveTab('calculate');
            }}
            style={{
              flex: 1,
              padding: '18px 20px',
              border: 'none',
              background: activeTab === 'calculate' ? 'white' : 'transparent',
              color: activeTab === 'calculate' ? '#667eea' : '#6c757d',
              cursor: 'pointer',
              fontWeight: activeTab === 'calculate' ? '700' : '500',
              fontSize: '16px',
              transition: 'all 0.3s ease',
              borderBottom: activeTab === 'calculate' ? '3px solid #667eea' : 'none',
              position: 'relative',
              top: activeTab === 'calculate' ? '2px' : '0'
            }}
          >
            🧮 이액 계산
          </button>
        </div>
        
        <div style={{ padding: '30px' }}>

      {activeTab === 'register' && (
        <div>
          <div style={{ 
            marginBottom: '25px', 
            padding: '25px', 
            background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
            borderRadius: '15px',
            border: '2px solid #667eea'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#667eea', fontSize: '20px', fontWeight: '700' }}>
              📋 강사목록 불러오기
            </h3>
            <p style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>
              CSV 파일 형식: 이름, 관번호(1,2,3,5)
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="file"
                accept=".csv"
                onChange={handleTeacherListUpload}
                style={{ flex: '1', minWidth: '200px' }}
              />
              <button
                onClick={exportTeacherList}
                style={{ 
                  padding: '10px 24px', 
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'transform 0.2s',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
                }}
              >
                📥 강사목록 다운로드
              </button>
            </div>
            {teacherListLoaded && (
              <div style={{ 
                marginTop: '15px', 
                padding: '12px 20px',
                background: '#d4edda',
                color: '#155724',
                fontWeight: '600',
                borderRadius: '8px',
                border: '1px solid #c3e6cb'
              }}>
                ✅ 강사목록이 로드되었습니다 ({teachers.length}명)
              </div>
            )}
          </div>

          <div style={{ 
            marginBottom: '25px', 
            padding: '25px', 
            background: '#f8f9fa',
            borderRadius: '15px',
            border: '2px solid #e9ecef'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#495057', fontSize: '18px', fontWeight: '700' }}>
              ➕ 강사 추가
            </h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="선생님 이름"
                value={newTeacher.name}
                onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                style={{ 
                  padding: '12px 16px', 
                  width: '200px',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <select
                value={newTeacher.campus}
                onChange={(e) => setNewTeacher({ ...newTeacher, campus: e.target.value })}
                style={{ 
                  padding: '12px 16px', 
                  width: '120px',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">관 선택</option>
                {CAMPUS_OPTIONS.map(campus => (
                  <option key={campus} value={campus}>{campus}</option>
                ))}
              </select>
              <button
                onClick={handleAddTeacher}
                style={{ 
                  padding: '12px 28px', 
                  background: 'linear-gradient(135deg, #28a745, #20c997)',
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  boxShadow: '0 4px 15px rgba(40, 167, 69, 0.3)'
                }}
              >
                추가하기
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={handleDeleteTeachers}
              style={{ 
                padding: '10px 24px', 
                background: 'linear-gradient(135deg, #dc3545, #c82333)',
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                boxShadow: '0 4px 15px rgba(220, 53, 69, 0.3)'
              }}
            >
              🗑️ 선택 삭제
            </button>
          </div>

          <div style={{ 
            borderRadius: '15px',
            overflow: 'hidden',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}>
                  <th style={{ padding: '16px', fontWeight: '600', fontSize: '14px' }}>선택</th>
                  <th style={{ padding: '16px', fontWeight: '600', fontSize: '14px' }}>선생님 이름</th>
                  <th style={{ padding: '16px', fontWeight: '600', fontSize: '14px' }}>관</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher, idx) => (
                  <tr key={teacher.id} style={{ 
                    background: idx % 2 === 0 ? '#ffffff' : '#f8f9fa'
                  }}>
                    <td style={{ padding: '14px', textAlign: 'center', borderBottom: '1px solid #e9ecef' }}>
                      <input
                        type="checkbox"
                        checked={selectedTeachers.includes(teacher.id)}
                        onChange={() => toggleTeacherSelection(teacher.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '14px', borderBottom: '1px solid #e9ecef', fontSize: '14px' }}>{teacher.name}</td>
                    <td style={{ padding: '14px', borderBottom: '1px solid #e9ecef', fontSize: '14px' }}>{teacher.campus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'calculate' && (
        <div>
          <div style={{ 
            padding: '20px', 
            background: 'linear-gradient(135deg, #fff3cd, #ffeaa7)',
            borderRadius: '15px',
            border: '2px solid #ffc107', 
            marginBottom: '25px'
          }}>
            <strong style={{ fontSize: '16px' }}>⚠️ 주의:</strong> 
            <span style={{ marginLeft: '8px', fontSize: '14px' }}>랠리즈에서 다운로드 후 이름을 바꾸지 말고 그대로 넣어주세요.</span>
          </div>

          {!teacherListLoaded && (
            <div style={{ 
              padding: '20px', 
              background: '#f8d7da',
              borderRadius: '15px',
              border: '2px solid #dc3545', 
              marginBottom: '25px', 
              color: '#721c24'
            }}>
              <strong style={{ fontSize: '16px' }}>❌ 강사목록을 먼저 불러와주세요!</strong> 
              <span style={{ marginLeft: '8px', fontSize: '14px' }}>"강사 등록" 탭에서 CSV 파일을 업로드하세요.</span>
            </div>
          )}

          <div style={{ 
            marginBottom: '25px',
            padding: '25px',
            background: '#f8f9fa',
            borderRadius: '15px',
            border: '2px solid #e9ecef'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#495057', fontSize: '18px', fontWeight: '700' }}>
              📅 청구 년월 선택
            </h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>년도</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  style={{ 
                    padding: '12px 16px', 
                    width: '120px',
                    border: '2px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {YEARS.map(year => (
                    <option key={year} value={year}>{year}년</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>월</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{ 
                    padding: '12px 16px', 
                    width: '120px',
                    border: '2px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {MONTHS.map(month => (
                    <option key={month} value={month}>{month}월</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ 
            marginBottom: '25px',
            padding: '25px',
            background: '#f8f9fa',
            borderRadius: '15px',
            border: '2px solid #e9ecef'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#495057', fontSize: '18px', fontWeight: '700' }}>
              📂 파일 업로드
            </h3>
            <input
              type="file"
              multiple
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ marginBottom: '15px', display: 'block' }}
            />
            <button
              onClick={processFiles}
              style={{
                padding: '14px 32px',
                background: teacherListLoaded ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: teacherListLoaded ? 'pointer' : 'not-allowed',
                fontWeight: '700',
                fontSize: '16px',
                boxShadow: teacherListLoaded ? '0 6px 20px rgba(102, 126, 234, 0.4)' : 'none'
              }}
              disabled={!teacherListLoaded}
            >
              🧮 계산하기
            </button>
          </div>

          {calculationResult && (
            <div style={{ marginTop: '30px' }}>
              <h3 style={{ 
                margin: '0 0 25px 0', 
                color: '#495057', 
                fontSize: '22px', 
                fontWeight: '700',
                paddingBottom: '15px',
                borderBottom: '3px solid #667eea'
              }}>
                📊 계산 결과
              </h3>
              {Object.keys(calculationResult).map(campus => (
                <div key={campus} style={{ 
                  marginBottom: '35px',
                  borderRadius: '15px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                }}>
                  <h4 style={{ 
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white', 
                    padding: '18px 25px',
                    margin: '0',
                    fontSize: '20px',
                    fontWeight: '700'
                  }}>
                    🏫 {campus}
                  </h4>
                  {Object.keys(calculationResult[campus]).map(teacher => (
                    <div key={teacher} style={{ 
                      padding: '20px 25px',
                      background: '#fff'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h5 style={{ 
                          background: 'linear-gradient(135deg, #e3f2fd, #f3e5f5)',
                          padding: '14px 20px',
                          margin: '0',
                          borderRadius: '10px',
                          fontSize: '18px',
                          fontWeight: '600',
                          color: '#495057',
                          flex: 1
                        }}>
                          👨‍🏫 {teacher} 선생님
                        </h5>
                        <button
                          onClick={() => copyTeacherData(campus, teacher)}
                          style={{
                            marginLeft: '15px',
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #17a2b8, #138496)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '14px',
                            boxShadow: '0 4px 15px rgba(23, 162, 184, 0.3)'
                          }}
                        >
                          📋 복사
                        </button>
                      </div>
                      <div style={{ 
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid #e9ecef'
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f8f9fa' }}>
                              <th style={{ padding: '14px', fontWeight: '600', fontSize: '14px', color: '#495057', borderBottom: '2px solid #dee2e6' }}>반</th>
                              <th style={{ padding: '14px', fontWeight: '600', fontSize: '14px', color: '#495057', borderBottom: '2px solid #dee2e6' }}>학생수</th>
                              <th style={{ padding: '14px', fontWeight: '600', fontSize: '14px', color: '#495057', borderBottom: '2px solid #dee2e6' }}>이액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.keys(calculationResult[campus][teacher]).map((className, idx) => {
                              const data = calculationResult[campus][teacher][className];
                              return (
                                <tr key={className} style={{ 
                                  background: idx % 2 === 0 ? '#ffffff' : '#f8f9fa'
                                }}>
                                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #e9ecef', fontSize: '14px' }}>
                                    {className}
                                  </td>
                                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #e9ecef', fontSize: '14px' }}>
                                    {data.specialInfo
                                      ? `60%: ${data.specialInfo.sixtyPercent}명, 50%: ${data.specialInfo.fiftyPercent}명`
                                      : `${data.studentCount}명`}
                                  </td>
                                  <td style={{ 
                                    padding: '12px 14px', 
                                    borderBottom: '1px solid #e9ecef',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#667eea'
                                  }}>
                                    {data.totalAmount.toLocaleString()}원
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

        </div>
      </div>

      {showAddDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            background: 'white', 
            padding: '30px', 
            borderRadius: '20px', 
            minWidth: '350px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#495057', fontSize: '20px', fontWeight: '700' }}>
              ✅ 추가 확인
            </h3>
            <div style={{ marginBottom: '15px', fontSize: '15px' }}>
              <strong>이름:</strong> <span style={{ marginLeft: '10px', color: '#667eea' }}>{newTeacher.name}</span>
            </div>
            <div style={{ marginBottom: '25px', fontSize: '15px' }}>
              <strong>관:</strong> <span style={{ marginLeft: '10px', color: '#667eea' }}>{newTeacher.campus}</span>
            </div>
            <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>추가하시겠습니까?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddDialog(false)}
                style={{ 
                  padding: '10px 24px', 
                  background: '#6c757d',
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                취소
              </button>
              <button
                onClick={confirmAddTeacher}
                style={{ 
                  padding: '10px 24px', 
                  background: 'linear-gradient(135deg, #28a745, #20c997)',
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  boxShadow: '0 4px 15px rgba(40, 167, 69, 0.3)'
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            background: 'white', 
            padding: '30px', 
            borderRadius: '20px', 
            minWidth: '350px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#495057', fontSize: '20px', fontWeight: '700' }}>
              ⚠️ 삭제 확인
            </h3>
            <p style={{ marginBottom: '25px', color: '#666', fontSize: '15px' }}>
              선택한 <strong style={{ color: '#dc3545' }}>{selectedTeachers.length}명</strong>의 강사를 삭제하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteDialog(false)}
                style={{ 
                  padding: '10px 24px', 
                  background: '#6c757d',
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                취소
              </button>
              <button
                onClick={confirmDeleteTeachers}
                style={{ 
                  padding: '10px 24px', 
                  background: 'linear-gradient(135deg, #dc3545, #c82333)',
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  boxShadow: '0 4px 15px rgba(220, 53, 69, 0.3)'
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherPaymentCalculator;